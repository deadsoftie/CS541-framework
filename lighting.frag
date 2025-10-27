/////////////////////////////////////////////////////////////////////////
// Pixel shader for lighting - OPTIMIZED VERSION
////////////////////////////////////////////////////////////////////////
#version 330

out vec4 FragColor;

// Object ID constants
const int nullId = 0, skyId = 1, seaId = 2, groundId = 3;
const int roomId = 4, boxId = 5, frameId = 6, lPicId = 7;
const int rPicId = 8, teapotId = 9, spheresId = 10, floorId = 11;

in vec3 normalVec, lightVec, eyeVec, tanVec;
in vec2 texCoord;

uniform int objectId;
uniform vec3 diffuse, specular, lightVal, lightAmb;
uniform float shininess, reflectionStrength;
uniform sampler2D textureImage, normalMap, skyboxTexture;
uniform int hasTexture, hasNormalMap;

const float PI = 3.14159265359;
const float INV_PI = 0.31830988618;
const float INV_2PI = 0.15915494309;

// Procedural checkerboard texture
vec3 proceduralTexture(vec2 uv) {
    vec2 checker = floor(uv * 10.0);
    return vec3(mod(checker.x + checker.y, 2.0));
}

// Texture with 10% border
vec3 conditionalTexture(vec2 uv, sampler2D tex) {
    const float border = 0.1;
    const float invScale = 1.0 / 0.8; // 1.0 / (1.0 - 2.0 * border)
    
    bvec4 inBorder = bvec4(uv.x < border, uv.x > 0.9, uv.y < border, uv.y > 0.9);
    if (any(inBorder)) return vec3(0.5);
    
    return texture(tex, (uv - border) * invScale).xyz;
}

vec3 sampleSkybox(vec3 dir, sampler2D skyTex) {
    vec2 uv = vec2(-atan(dir.y, dir.x) * INV_2PI, acos(dir.z) * INV_PI);
    return texture(skyTex, uv).xyz;
}

// Get UV scaling based on object ID
vec2 getScaledUV(int id, vec2 uv) {
    if (id == roomId) return uv.yx * 10.0;
    if (id == groundId) return uv * 50.0;
    if (id == floorId) return uv * 5.0;
    if (id == seaId) return uv * 100.0;
    return uv;
}

void main() {
    vec3 N = normalize(normalVec);
    vec3 V = normalize(eyeVec);
    
    if (objectId == skyId) {
        FragColor = vec4(sampleSkybox(V, textureImage), 1.0);
        return;
    }
    
    // Compute UV once
    vec2 uv = getScaledUV(objectId, texCoord);
    
    if (hasNormalMap == 1) {
        vec3 delta = texture(normalMap, uv).xyz * 2.0 - 1.0;
        vec3 T = normalize(tanVec);
        vec3 B = cross(T, N);
        N = normalize(delta.x * T + delta.y * B + delta.z * N);
    }
    
    if (objectId == seaId) {
        vec3 R = reflect(-V, N);
        vec2 reflectUV = vec2(-atan(R.y, R.x) * INV_2PI, acos(R.z) * INV_PI);
        FragColor = texture(textureImage, reflectUV);
        return;
    }
    
    vec3 Kd = diffuse;
    if (objectId == lPicId) {
        Kd = proceduralTexture(texCoord);
    } else if (hasTexture == 1) {
        Kd = (objectId == rPicId) ? 
             conditionalTexture(texCoord, textureImage) : 
             texture(textureImage, uv).xyz;
    }
    
    // Handle pure reflections early
    if (reflectionStrength >= 0.99) {
        vec3 R = reflect(-V, N);
        FragColor = vec4(sampleSkybox(R, skyboxTexture), 1.0);
        return;
    }
    
    vec3 L = normalize(lightVec);
    vec3 H = normalize(L + V);

    float NdotL = max(dot(N, L), 0.0);
    float NdotH = max(dot(N, H), 0.0);
    float LdotH = max(dot(L, H), 0.0);
    
    // Microfacet BRDF
    vec3 F = specular + (1.0 - specular) * pow(1.0 - LdotH, 5.0);
    float G = 1.0 / (LdotH * LdotH);
    float D = (shininess + 2.0) * 0.5 * INV_PI * pow(NdotH, shininess);
    
    vec3 diffuseBRDF = Kd * INV_PI;
    vec3 specularBRDF = (F * G * D) * 0.25;
    
    // Final lighting
    vec3 color = lightAmb * Kd + lightVal * NdotL * (diffuseBRDF + specularBRDF);
    
    // Mix in reflections if needed
    if (reflectionStrength > 0.0) {
        vec3 R = reflect(-V, N);
        color = mix(color, sampleSkybox(R, skyboxTexture), reflectionStrength);
    }
    
    FragColor = vec4(color, 1.0);
}