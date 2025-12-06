/////////////////////////////////////////////////////////////////////////
// Fragment Shader - Lighting Pass with IBL and Dual Paraboloid Reflections
//
// Implements Image-Based Lighting using HDR skybox and irradiance maps,
// combined with dual paraboloid environment mapping for reflections.
//
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
uniform float exposure;
uniform float skyboxReflectionStrength;

// Texture mapping flags
uniform bool useTex;
uniform bool useNormal;

// Texture samplers
uniform sampler2D tex;
uniform sampler2D normalMap;
uniform sampler2D hdrSkybox;
uniform sampler2D irradianceMap;
uniform sampler2D shadowMap;
uniform sampler2D upperReflectionTexture, lowerReflectionTexture;

// Function declarations (implementations defined in separate shader library)
vec3 ComputeBRDF(vec3 N, vec3 V, vec3 L, vec3 Ks, vec3 Kd, vec3 Ia, vec3 Il, float a, float shadow);
vec3 SampleSkybox(vec3 reference, sampler2D skyTexture);
vec3 SampleIrradianceMap(vec3 N, sampler2D irradianceMap);
vec3 ApplyNormalMapping(vec3 N, vec2 uv, vec3 tanVec, sampler2D normalMap);
vec2 SetUV(int objectId, vec2 uv);
vec3 GenerateCheckerboardPattern(vec2 uv);
vec3 SampleTextureWithFrame(sampler2D tex, vec2 uv);
bool TestShadowOcclusion(vec4 shadowCoord, sampler2D shadowMap);
vec3 ComputeIBLDiffuse(vec3 N, vec3 Kd, sampler2D irradianceMap);
vec3 ComputeIBLSpecular(vec3 N, vec3 V, vec3 R, vec3 Ks, float a, sampler2D hdrSkybox);
vec3 ApplyToneMapping(vec3 color, float exposure);

/**
 * Samples dual paraboloid reflection maps based on reflection vector
 * 
 * Converts a 3D reflection vector into 2D texture coordinates for dual
 * paraboloid mapping. This technique divides the environment into upper
 * and lower hemispheres, providing efficient real-time reflections with
 * better uniformity than spherical mapping and lower cost than cubemaps.
 */
vec3 ReflectionCalculation(vec3 R)
{    
    vec3 d = normalize(R);
    float a = d.x;
    float b = d.y;
    float c = d.z;

    // Choose hemisphere based on z-component sign
    bool useUpper = c > 0.0;
    float hemisphereSignNotation = useUpper ? 1.0 : -1.0;
    
    // Project onto paraboloid surface using division by (1 + |z|)
    float denom = 1.0 + c * hemisphereSignNotation;
    vec2 uv = vec2(a, b) / denom;
    
    // Remap from [-1,1] to [0,1] texture coordinate space
    uv = uv * 0.5 + vec2(0.5);

    // Sample appropriate hemisphere texture
    return useUpper ? texture(upperReflectionTexture, uv).rgb : texture(lowerReflectionTexture, uv).rgb;
}

void main()
{       
    // Normalize interpolated vectors from vertex shader
    vec3 N = normalize(normalVec);
    vec3 V = normalize(eyeVec);
    vec3 L = normalize(lightVec);

    // Initialize material properties from uniforms
    vec3 Kd = diffuse;   
    vec3 Ks = specular;
    float a = shininess;
        
    vec3 H = normalize(L + V);
    
    // Early exit: Skybox rendering (no lighting calculations needed)
    if(objectId == skyId)
    {
        vec3 skyColor = SampleSkybox(V, hdrSkybox);
        FragColor.xyz = ApplyToneMapping(skyColor, exposure);
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

    // Special case: Sea surface uses direct skybox reflection
    if(objectId == seaId)
    {
        vec3 R = reflect(V, N);
        vec3 reflection = SampleSkybox(R, hdrSkybox);
        
        // Apply tone mapping to sea reflection
        FragColor.xyz = ApplyToneMapping(reflection, exposure);
        return;
    }     

    // ========================================================================
    // IBL LIGHTING CALCULATION
    // ========================================================================
    
    // Compute reflection vector (for specular IBL)
    vec3 R = reflect(-V, N);
    
    // IBL Diffuse: Sample irradiance map based on surface normal
    vec3 iblDiffuse = ComputeIBLDiffuse(N, Kd, irradianceMap);
    
    // IBL Specular: Sample environment map in reflection direction
    vec3 iblSpecular = ComputeIBLSpecular(N, V, R, Ks, a, hdrSkybox);
    
    // Combine diffuse and specular IBL contributions
    vec3 iblColor = iblDiffuse + iblSpecular;
    
    // ========================================================================
    // REFLECTIVE OBJECTS: Blend with dual paraboloid reflections
    // ========================================================================
    
    if(isReflective)
    {
        // Sample dual paraboloid reflection maps
        vec3 reflection = ReflectionCalculation(R);
        
        // Blend IBL lighting with reflection based on skybox reflection strength
        iblColor = mix(iblColor, reflection, skyboxReflectionStrength);
    }
    
    // ========================================================================
    // TONE MAPPING AND OUTPUT
    // ========================================================================
    
    // Apply tone mapping, exposure control, and gamma correction
    FragColor.xyz = ApplyToneMapping(iblColor, 1.0);
}