/////////////////////////////////////////////////////////////////////////
// Pixel shader for lighting
////////////////////////////////////////////////////////////////////////
#version 330

out vec4 FragColor;

// These definitions agree with the ObjectIds enum in scene.h
const int     nullId	= 0;
const int     skyId	= 1;
const int     seaId	= 2;
const int     groundId	= 3;
const int     roomId	= 4;
const int     boxId	= 5;
const int     frameId	= 6;
const int     lPicId	= 7;
const int     rPicId	= 8;
const int     teapotId	= 9;
const int     spheresId	= 10;
const int     floorId	= 11;

in vec3 normalVec, lightVec, eyeVec;
in vec2 texCoord;

uniform int objectId;
uniform vec3 diffuse;
uniform vec3 specular;
uniform float shininess;
uniform vec3 lightVal;     // Ii (Light intensity)
uniform vec3 lightAmb;     // Ia (Ambient light)

const float PI = 3.14159265359;

void main()
{
    vec3 N = normalize(normalVec);
    vec3 L = normalize(lightVec);
    vec3 V = normalize(eyeVec);
    vec3 H = normalize(L + V);

    vec3 Kd = diffuse;

    // A checkerboard pattern to break up large flat expanses.  Remove when using textures.
    if (objectId==groundId || objectId==floorId || objectId==seaId) {
        ivec2 uv = ivec2(floor(100.0*texCoord));
        if ((uv[0]+uv[1])%2==0)
            Kd *= 0.9; }

    // // Lighting calculations
    // float LN = max(dot(L,N), 0.0);
    // float HN = max(dot(H,N), 0.0);

    // // Phong lighting model
    // vec3 ambient = lightAmb * Kd;
    // vec3 diffuseContrib = lightVal * Kd * LN;
    // vec3 specularContrib = lightVal * specular * pow(HN, shininess);

    // Clamping all the dot products to non-negative values
    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);
    float NdotH = max(dot(N, H), 0.0);
    float LdotH = max(dot(L, H), 0.0);
    float VdotH = max(dot(V, H), 0.0);

    // MICROFACET BRDF CALCULATION

    // Fresnel term - Schlick approximation
    vec3 F = specular + (vec3(1.0) - specular) * pow(1.0 - LdotH, 5.0);
    
    // Masking term
    float G_over_4NdotLNdotV = 1.0 / (LdotH * LdotH);
    
    // Normal distribution term D
    float D = (shininess + 2.0) / (2.0 * PI) * pow(NdotH, shininess);
    
    // BRDF components
    vec3 diffuseBRDF = Kd / PI;
    vec3 specularBRDF = F * G_over_4NdotLNdotV * D;
    
    // Total BRDF
    vec3 BRDF = diffuseBRDF + specularBRDF;
    
    // Final lighting calculation
    vec3 ambient = lightAmb * Kd;
    vec3 directLighting = lightVal * NdotL * BRDF;
    
    FragColor.xyz = ambient + directLighting;
    FragColor.w = 1.0;
}
