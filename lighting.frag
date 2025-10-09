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
uniform vec3 lightVal;
uniform vec3 lightAmb; 

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

    // Lighting calculations
    float LN = max(dot(L,N), 0.0);
    float HN = max(dot(H,N), 0.0);

    // Phong lighting model
    vec3 ambient = lightAmb * Kd;
    vec3 diffuseContrib = lightVal * Kd * LN;
    vec3 specularContrib = lightVal * specular * pow(HN, shininess);
    
    FragColor.xyz = vec3(0.5,0.5,0.5)*Kd + Kd*max(dot(L,N),0.0);
}
