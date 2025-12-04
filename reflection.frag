/////////////////////////////////////////////////////////////////////////
// Fragment Shader - Reflection Pass with PBR Lighting
//
// Implements environment reflections, skybox rendering, and shadow-mapped
// physically-based lighting. Handles special cases for different object
// types including procedural textures and framed images.
//
// Copyright 2013 DigiPen Institute of Technology
////////////////////////////////////////////////////////////////////////
#version 330

out vec4 FragColor;

// Object identifier constants - synchronized with scene.h ObjectIds enum
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

// Vertex shader outputs (interpolated per-fragment)
in vec3 normalVec, lightVec, eyeVec, tanVec;
in vec2 texCoord;
in vec4 shadowCoord;

// Material and lighting uniforms
uniform int objectId;
uniform vec3 diffuse, specular, light, ambient;
uniform float shininess;
uniform bool isReflective;

// Texture mapping flags
uniform bool useTex;
uniform bool useNormal;

// Texture samplers
uniform sampler2D tex;
uniform sampler2D normalMap;
uniform sampler2D skyTexture;
uniform sampler2D shadowMap;

// Function declarations (implementations defined in separate shader library)
vec3 ComputeBRDF(vec3 N, vec3 V, vec3 L, vec3 Ks, vec3 Kd, vec3 Ia, vec3 Il, float a, float shadow);
vec3 SampleSkybox(vec3 reference, sampler2D skyTexture);
vec3 ApplyNormalMapping(vec3 N, vec2 uv, vec3 tanVec, sampler2D normalMap);
vec2 SetUV(int objectId, vec2 uv);
vec3 GenerateCheckerboardPattern(vec2 uv);
vec3 SampleTextureWithFrame(sampler2D tex, vec2 uv);
bool TestShadowOcclusion(vec4 shadowCoord, sampler2D shadowMap);

void main()
{    
    // Normalize interpolated vectors from vertex shader
    vec3 N = normalize(normalVec);
    vec3 V = normalize(eyeVec);
    vec3 L = normalize(lightVec);

    // Initialize lighting parameters from uniforms
    vec3 Ia = ambient;
    vec3 Il = light;
    
    // Initialize material properties from uniforms
    vec3 Kd = diffuse;   
    vec3 Ks = specular;
    float a = shininess;
        
    vec3 H = normalize(L + V);
    
    // Early exit: Skybox rendering (no lighting calculations needed)
    if(objectId == skyId)
    {
        FragColor.xyz = SampleSkybox(V, skyTexture);
        return;
    }

    // Apply object-specific UV transformations for proper texture tiling
    vec2 uv = texCoord;
    uv = SetUV(objectId, uv);
    
    // Special case: Left picture frame uses procedural checkerboard
    if(objectId == lPicId)
    {
        FragColor.xyz = GenerateCheckerboardPattern(uv);
        return;
    }
    
    // Special case: Right picture frame with decorative border
    if(objectId == rPicId)
    {
        FragColor.xyz = SampleTextureWithFrame(tex, uv);
        return;
    }

    // Apply normal mapping if enabled (for surface detail)
    if(useNormal)
        N = ApplyNormalMapping(N, uv, tanVec, normalMap);
        
    // Override diffuse color with texture if enabled
    if(useTex)
        Kd = texture(tex, uv).rgb;

    // Compute reflection vector for environment reflections
    // Formula: R = 2(N·V)N - V, negated for proper reflection direction
    vec3 R = -(2 * dot(V, N) * N - V);
    vec3 reflection = SampleSkybox(R, skyTexture);
    
    // Special case: Sea surface uses pure reflection (mirror-like)
    if(objectId == seaId)
    {
        FragColor.xyz = reflection;
        return;
    }     

    // Compute shadow factor: 0.0 if in shadow, 1.0 if fully lit
    float shadowFactor = TestShadowOcclusion(shadowCoord, shadowMap) ? 0.0 : 1.0;

    // Compute physically-based lighting using Cook-Torrance BRDF
    vec3 lightColor = ComputeBRDF(N, V, L, Ks, Kd, Ia, Il, a, shadowFactor);
    
    // Blend lighting with environment reflection based on material reflectivity
    // Reflective objects mix 50% lighting with 50% reflection
    float reflectivity = isReflective ? 0.5 : 0.0;
    FragColor = vec4(mix(lightColor, reflection, reflectivity), 1.0);
}
