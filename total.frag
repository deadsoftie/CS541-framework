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

in vec3 normalVec, lightVec, eyeVec, tanVec;
in vec2 texCoord;
in vec4 shadowCoord;

uniform int objectId;
uniform vec3 diffuse, specular, light, ambient;
uniform float shininess;//alpha exponent
uniform bool isReflective;

uniform bool useTex;
uniform bool useNormal;

uniform sampler2D tex;
uniform sampler2D normalMap;
uniform sampler2D skyTexture;
uniform sampler2D shadowMap;
uniform sampler2D upperReflectionTex, lowerReflectionTex;


vec3 BRDF(vec3 N, vec3 V, vec3 L, vec3 Ks, vec3 Kd, vec3 Ia, vec3 Il, float a, float shadow);
vec3 SkyCalculation(vec3 reference, sampler2D skyTexture);
vec3 CalcNormal(vec3 N, vec2 uv, vec3 tanVec, sampler2D normalMap);
vec2 SetUV(int objectId, vec2 uv);
vec3 ProceduralImage(vec2 uv);
vec3 RightFrameImage(sampler2D tex, vec2 uv);
bool IsInShadow(vec4 shadowCoord, sampler2D shadowMap);

vec3 ReflectionCalculation(vec3 R)
{    
    vec3 d = normalize(R);
    float a = d.x;
    float b = d.y;
    float c = d.z;

    bool useUpper = c > 0.0;
    float hemiSign = useUpper ? 1.0 : -1.0;
    float denom = 1.0 + c * hemiSign;
    vec2 uv = vec2(a, b) / denom;
    uv = uv * 0.5 + vec2(0.5);

    return useUpper ? texture(upperReflectionTex, uv) : texture(lowerReflectionTex, uv);
}

void main()
{       
    vec3 N = normalize(normalVec);
    vec3 V = normalize(eyeVec);
    vec3 L = normalize(lightVec);

    vec3 Ia = ambient;
    vec3 Il = light;
    
    vec3 Kd = diffuse;   
    vec3 Ks = specular;
    float a = shininess;
        
    vec3 H = normalize(L + V);
    
    // if the object is a sky, only apply sky dome calculation
    if(objectId == skyId)
    {
        FragColor.xyz = SkyCalculation(V, skyTexture);
        return;
    }

    // change uv in terms of object
    vec2 uv = texCoord;
    uv = SetUV(objectId, uv);
    if(objectId == lPicId)
    {
        FragColor.xyz = ProceduralImage(uv);
        return;
    }
    if(objectId == rPicId)
    {
        FragColor.xyz = RightFrameImage(tex, uv);
        return;
    }

    // get normal from normal map
    if(useNormal)
        N = CalcNormal(N, uv, tanVec, normalMap);
        
    // sample color from texture
    if(useTex)
        Kd = texture(tex, uv).rgb;

    // calculate reflection from sky dome
    if(objectId == seaId)
    {
        vec3 R = reflect(V, N);
        vec3 reflection = SkyCalculation(R, skyTexture);
        FragColor.xyz = reflection;
        return;
    }     

    // is the pixel in shadow?
    float shadowFactor = IsInShadow(shadowCoord, shadowMap) ? 0.0 : 1.0;

    //Initial value :
    //FragColor.xyz = vec3(0.5,0.5,0.5)*Kd + Kd*max(dot(L,N),0.0);

    //Phong Lighting :
    //Ks *= 10;
    //FragColor.xyz = Ia * Kd + Il * Kd * LN + Il * Ks * pow(HN, a);

    //Micro-Facet BRDF Lighting :
    vec3 lightColor = BRDF(N, V, L, Ks, Kd, Ia, Il, a, shadowFactor);
    vec3 nKs = isReflective ? Ks * 5 : 0;
    
    if(!isReflective)
    {
        FragColor.xyz = lightColor;
        return;
    }
    
    Ks *= 5;
    vec3 R = reflect(-V, N);
    vec3 reflection = ReflectionCalculation(R);
    vec3 finalColor = mix(lightColor, reflection, Ks);
    FragColor.xyz = finalColor;
        
}
