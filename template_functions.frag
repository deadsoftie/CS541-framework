/////////////////////////////////////////////////////////////////////////
// Pixel shader for lighting
////////////////////////////////////////////////////////////////////////
#version 330

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

// Mathematical constants
const float PI = 3.1415926;
const float INV_PI = 0.31830988618;      // 1 / PI
const float INV_2PI = 0.15915494309;     // 1 / (2 * PI)
const float SHADOW_BIAS = 0.005;         // Bias to prevent shadow acne

/**
 * ComputeBRDF - Calculates physically-based lighting using Cook-Torrance model
 * 
 * Implements the Cook-Torrance BRDF with Schlick's Fresnel approximation,
 * Blinn-Phong distribution, and simplified geometry term. Combines diffuse
 * and specular contributions with ambient lighting and shadow attenuation.
 *
 * @param N       - Surface normal (normalized)
 * @param V       - View direction from surface to camera (normalized)
 * @param L       - Light direction from surface to light (normalized)
 * @param Ks      - Specular reflectance color at normal incidence (F0)
 * @param Kd      - Diffuse albedo color
 * @param Ia      - Ambient light intensity/color
 * @param Il      - Direct light intensity/color
 * @param a       - Specular exponent (shininess/smoothness parameter)
 * @param shadow  - Shadow factor [0.0 = fully shadowed, 1.0 = fully lit]
 * @return        - Final outgoing radiance (RGB color)
 */
vec3 ComputeBRDF(vec3 N, vec3 V, vec3 L, vec3 Ks, vec3 Kd, vec3 Ia, vec3 Il, float a, float shadow)
{
    // Calculate half vector for specular reflection
    vec3 H = normalize(L + V);

    // Compute dot products (clamped to prevent negative values)
    float LN = max(dot(L, N), 0.0);
    float HN = max(dot(H, N), 0.0);
    float LH = max(dot(L, H), 0.0);
    
    // Fresnel term - Schlick's approximation
    vec3 F = Ks + (1.0 - Ks) * pow(1.0 - LH, 5.0);

    // Geometry term - Simplified attenuation factor
    float G = 1/pow(LH, 2.0);

    // Distribution term - Normalized Blinn-Phong
    float D = ((a + 2.0) / (2.0 * PI)) * pow(HN, a);

    // Cook-Torrance specular BRDF: (F * G * D) / (4 * (N·L) * (N·V))
    vec3 specularBRDF = (F * G * D) / 4.0;
    
    // Lambertian diffuse BRDF (energy conserving)
    vec3 diffuseBRDF = Kd * INV_PI;
    
    // Combine diffuse and specular
    vec3 totalBRDF = diffuseBRDF + specularBRDF;
    
    // Final lighting equation: ambient + direct lighting with shadow
    return Ia * Kd + Il * LN * totalBRDF * shadow;
}

/**
 * SampleSkybox - Converts 3D direction to skybox UV coordinates
 * 
 * Maps a directional vector to equirectangular (spherical) texture coordinates
 * suitable for environment/skybox sampling. Uses spherical coordinate conversion.
 *
 * @param direction   - 3D direction vector (does not need to be normalized)
 * @param hdrSkybox   - Equirectangular environment map sampler
 * @return            - Sampled skybox color (RGB)
 */
vec3 SampleSkybox(vec3 reference, sampler2D hdrSkybox)
{
    vec2 uv = vec2(-atan(reference.y, reference.x) * INV_2PI, acos(reference.z) * INV_PI);
    return texture(hdrSkybox, uv).rgb;
}

/**
 * SampleIrradianceMap - Samples the pre-computed irradiance map
 * 
 * Samples the irradiance map for a given surface normal to get
 * the incoming diffuse lighting from all directions.
 *
 * @param N              - Surface normal (normalized)
 * @param irradianceMap  - Pre-computed irradiance map sampler
 * @return               - Diffuse irradiance (RGB)
 */
vec3 SampleIrradianceMap(vec3 N, sampler2D irradianceMap)
{
    vec2 uv = vec2(-atan(N.y, N.x) * INV_2PI, acos(N.z) * INV_PI);
    return texture(irradianceMap, uv).rgb;
}

/**
 * ApplyNormalMapping - Transforms normal map to world space using TBN matrix
 * 
 * Converts a tangent-space normal from a normal map into world space
 * by constructing a Tangent-Bitangent-Normal (TBN) transformation matrix.
 * The normal map is assumed to store normals in [0,1] range.
 *
 * @param N         - World-space surface normal (normalized)
 * @param uv        - Texture coordinates for normal map sampling
 * @param tanVec    - World-space tangent vector
 * @param normalMap - Normal map texture sampler (RGB format)
 * @return          - Perturbed world-space normal (normalized)
 */
vec3 ApplyNormalMapping(vec3 N, vec2 uv, vec3 tanVec, sampler2D normalMap)
{
    vec3 delta = texture(normalMap, uv).xyz;
    delta = delta * 2.0 - vec3(1, 1, 1);
    vec3 T = normalize(tanVec);
    vec3 B = normalize(cross(T, N));

    return normalize(delta.x * T + delta.y * B + delta.z * N);
}

/**
 * SetUV - Applies object-specific UV scaling
 * 
 * Modifies texture coordinates based on object type to achieve proper
 * texture tiling for different surface types (rooms, terrain, etc.).
 *
 * @param objectId - Integer identifier for the object type
 * @param uv       - Input texture coordinates
 * @return         - Scaled/transformed texture coordinates
 */
vec2 SetUV(int objectId, vec2 uv)
{
    if(objectId == roomId) return uv.yx * 10;
    if(objectId == seaId) return uv * 100;
    if(objectId == groundId) return uv * 50;
    return uv;
}

/**
 * GenerateCheckerboardPattern - Creates a procedural checkerboard texture
 * 
 * Generates a black and white checkerboard pattern from UV coordinates.
 * Each checker is 0.1 units in UV space (10x10 grid).
 *
 * @param uv - Texture coordinates
 * @return   - Grayscale checkerboard value (0.0 or 1.0)
 */
vec3 GenerateCheckerboardPattern(vec2 uv)
{
    // Create 10x10 grid and determine checker color by parity
    vec2 checker = floor(uv * 10.0);
    float pattern = mod(checker.x + checker.y, 2.0);
    return vec3(pattern);
}

/**
 * SampleTextureWithFrame - Samples texture with decorative border frame
 * 
 * Renders a texture with a 10% border frame around it. The frame appears
 * as a mid-gray (0.5) border, with the texture scaled and centered in
 * the remaining 80% of the space.
 *
 * @param tex - Texture sampler to sample from
 * @param uv  - Texture coordinates [0,1]
 * @return    - Color value (gray frame or sampled texture)
 */
vec3 SampleTextureWithFrame(sampler2D tex, vec2 uv)
{
    // Check if UV is in the 10% border region
    if(uv.x < 0.1 || uv.x > 0.9 || uv.y < 0.1 || uv.y > 0.9)
        return vec3(0.5);  // Gray frame color
    
    // Sample from inner 80% region, remapping UVs
    vec2 innerUV = (uv - 0.1) / 0.8;
    return texture(tex, innerUV).rgb;
}

/**
 * TestShadowOcclusion - Determines if a surface point is in shadow
 * 
 * Performs shadow map comparison to determine if the current fragment
 * is occluded from the light source. Includes border checks to prevent
 * shadows outside the shadow map coverage area and bias to reduce
 * shadow acne artifacts.
 *
 * @param shadowCoord - Light-space position (homogeneous coordinates)
 * @param shadowMap   - Depth texture from light's perspective
 * @return            - true if in shadow, false if lit
 */
bool TestShadowOcclusion(vec4 shadowCoord, sampler2D shadowMap)
{
    // Perform perspective divide to get normalized device coordinates
    vec2 shadowIndex = shadowCoord.xy / shadowCoord.w;
    
    // Check if fragment is outside shadow map coverage
    // (behind light or outside frustum boundaries)
    if (shadowCoord.w <= 0.0 || 
        shadowIndex.x < 0.0 || shadowIndex.x > 1.0 ||
        shadowIndex.y < 0.0 || shadowIndex.y > 1.0) 
    {
        return false;  // Not in shadow (outside shadow map)
    }
    
    // Sample depth from shadow map (stored in w component)
    float lightDepth = texture(shadowMap, shadowIndex).w;

    // Current fragment's depth from light's perspective
    float pixelDepth = shadowCoord.w;

    // Comparison with bias to prevent self-shadowing artifacts (shadow acne)
    if(pixelDepth > lightDepth + SHADOW_BIAS)
        return true;   // Fragment is occluded (in shadow)
    
    return false;      // Fragment is visible (lit)
}

/**
 * ComputeIBLDiffuse - Calculates diffuse lighting from irradiance map
 * 
 * @param N              - Surface normal (normalized)
 * @param Kd             - Diffuse albedo color
 * @param irradianceMap  - Precomputed irradiance map sampler
 * @return               - Diffuse contribution from environment
 */
vec3 ComputeIBLDiffuse(vec3 N, vec3 Kd, sampler2D irradianceMap)
{
    // Sample irradiance map using surface normal
    // The irradiance map contains the precomputed integral: ∫ Li(ωi) * (N·ωi)+ dωi
    vec3 irradiance = SampleIrradianceMap(-N, irradianceMap);
    
    // Apply diffuse BRDF coefficient: Kd/π
    // This gives us the complete diffuse term: (Kd/π) * irradiance(N)
    return (Kd * INV_PI) * irradiance;
}

/**
 * ComputeIBLSpecular - Calculates specular reflection from environment
 * 
 * @param N           - Surface normal (normalized)
 * @param V           - View direction (normalized)
 * @param R           - Reflection direction (normalized): R = 2(V·N)N - V
 * @param Ks          - Specular reflectance at normal incidence (F0)
 * @param a           - Specular exponent (shininess)
 * @param hdrSkybox   - HDR environment map sampler
 * @return            - Specular contribution from environment
 */
vec3 ComputeIBLSpecular(vec3 N, vec3 V, vec3 R, vec3 Ks, float a, sampler2D hdrSkybox)
{
    // Sample environment map in reflection direction - this is Li(R)
    vec3 Li = SampleSkybox(-R, hdrSkybox);
    // Compute the halfway vector between R (acting as light direction) and V

    vec3 H = normalize(R + V);
    
    // Compute required dot products
    float NR = max(dot(N, R), 0.0);  // Note: Using N·R as per handout
    float NV = max(dot(N, V), 0.0);
    float RH = max(dot(R, H), 0.0);  // For Fresnel (F) and Geometry (G)
    float NH = max(dot(N, H), 0.0);  // For Distribution (D)
    
    // Prevent division by zero
    if (NR < 0.0001 || NV < 0.0001) {
        return vec3(0.0);
    }
    
    // Fresnel term - Schlick's approximation: F(R,H)
    // Uses the angle between R and H (not V and H)
    vec3 F = Ks + (1.0 - Ks) * pow(1.0 - RH, 5.0);
    
    // Geometry term - Simplified: G(R,V,H)
    float G = 1.0 / pow(RH, 2.0);
    
    // Distribution term - Normalized Blinn-Phong: D(H)
    float D = ((a + 2.0) / (2.0 * PI)) * pow(NH, a);
    
    // Complete specular BRDF: [D * G * F] / [4 * (R·N) * (V·N)]
    vec3 specularBRDF = (D * G * F) / 4.0;
    
    // Final specular per handout: Li(R) * (N·R)+ * BRDF
    // The (N·R)+ term accounts for the cosine factor in the rendering equation
    return Li * NR * specularBRDF;
    
}

/**
 * ApplyToneMapping - Converts HDR color to displayable LDR with exposure
 *
 * @param color    - Input HDR color (linear space, range [0,∞])
 * @param exposure - Exposure adjustment factor (e in the formula)
 * @return         - Output LDR color (sRGB space, range [0,1])
 */
vec3 ApplyToneMapping(vec3 color, float exposure)
{
    // Apply exposure control: e * C_in
    vec3 exposed = exposure * color;
    
    // Reinhard tone mapping: x / (x + 1)
    // Maps [0,∞] to [0,1] range
    vec3 toneMapped = exposed / (exposed + vec3(1.0));
    
    // Gamma correction: linear to sRGB (gamma 2.2)
    // Raises to power of 1/2.2 to counteract display's implicit 2.2 gamma
    vec3 gammaCorrected = pow(toneMapped, vec3(1.0 / 2.2));
    
    return gammaCorrected;
}