/////////////////////////////////////////////////////////////////////////
// Pixel shader for lighting
////////////////////////////////////////////////////////////////////////
#version 330

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

const float PI = 3.1415926;
const float INV_PI = 0.31830988618;
const float INV_2PI = 0.15915494309;
const float SHADOW_BIAS = 0.005;

vec3 BRDF(vec3 N, vec3 V, vec3 L, vec3 Ks, vec3 Kd, vec3 Ia, vec3 Il, float a, float shadow)
{
    vec3 H = normalize(L + V);
    float LN = max(dot(L, N), 0.0);
    float HN = max(dot(H, N), 0.0);
    float LH = max(dot(L, H), 0.0);
    
    vec3 F = Ks + (1.0 - Ks) * pow(1.0 - LH, 5.0);
    float G = 1/pow(LH, 2.0);   
    float D = ((a + 2.0) / (2.0 * PI)) * pow(HN, a);

    vec3 BRDF = (Kd / PI) + ((F * G * D)/4);
    
    return Ia * Kd + Il * LN * BRDF * shadow;
}
vec3 SkyCalculation(vec3 reference, sampler2D skyTexture)
{
    vec2 uv = vec2(-atan(reference.y, reference.x) * INV_2PI, acos(reference.z) * INV_PI);
    return texture(skyTexture, uv).rgb;
}

vec3 CalcNormal(vec3 N, vec2 uv, vec3 tanVec, sampler2D normalMap)
{
    vec3 delta = texture(normalMap, uv).xyz;
    delta = delta * 2.0 - vec3(1, 1, 1);
    vec3 T = normalize(tanVec);
    vec3 B = normalize(cross(T, N));

    return normalize(delta.x * T + delta.y * B + delta.z * N);
}

vec2 SetUV(int objectId, vec2 uv)
{
    if(objectId == roomId) return uv.yx * 10;
    if(objectId == seaId) return uv * 100;
    if(objectId == groundId) return uv * 50;
    return uv;
}

vec3 ProceduralImage(vec2 uv)
{
    vec2 checker = floor(uv * 10.0);
    return vec3(mod(checker.x + checker.y, 2.0));
}

vec3 RightFrameImage(sampler2D tex, vec2 uv)
{
    if(uv.x < .1 || uv.x >.9 || uv.y < .1 || uv.y > .9)
        return vec3(0.5);
    return texture(tex, (uv - 0.1) / 0.8).rgb;
}

bool IsInShadow(vec4 shadowCoord, sampler2D shadowMap)
{
    vec2 shadowIndex = shadowCoord.xy / shadowCoord.w;
    
    // is the pixel inside the shadow map?
    if (shadowCoord.w <= 0.0 || 
        shadowIndex.x < 0.0 || shadowIndex.x > 1.0 ||
        shadowIndex.y < 0.0 || shadowIndex.y > 1.0) 
    {
        return false;
    }
    
    // depth from shadow map
    float lightDepth = texture(shadowMap, shadowIndex).w;

    // depth from camera
    float pixelDepth = shadowCoord.w;

    // pixel in Shadow if further from shadow depth
    // add bias to prevent shadows from itself -> Reduce acne
    if( pixelDepth > lightDepth + SHADOW_BIAS)
        return true;
    
    return false;    
}
