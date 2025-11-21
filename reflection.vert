/////////////////////////////////////////////////////////////////////////
// Vertex shader for reflection
//
// Copyright 2013 DigiPen Institute of Technology
////////////////////////////////////////////////////////////////////////
#version 330

uniform mat4 ModelTr, NormalTr;
uniform mat4 ShadowMatrix;

in vec4 vertex;
in vec3 vertexNormal;
in vec2 vertexTexture;
in vec3 vertexTangent;

out vec3 normalVec, lightVec, eyeVec, tanVec;
out vec2 texCoord;
out vec4 shadowCoord;

uniform vec3 lightPos;
uniform vec3 centerOfReflection;
uniform float hemiSign;

void main()
{     
    // world position of vertex;
    vec3 worldPos = (ModelTr * vertex).xyz;

    // paraboloid projection from reflection center
    vec3 EYE = centerOfReflection;

    vec3 R = worldPos - EYE;
    float lenR = length(R);
    vec3 d = R / lenR;
    float a = d.x;
    float b = d.y;
    float c = d.z;

    // 1 +- c branch with hemiSign
    float denom = 1.0 + hemiSign * c;

    float clipX = a / denom;
    float clipY = b / denom;
    float clipZ = hemiSign * c * lenR / 1000.0 - 1.f;

    // projection position
    gl_Position = vec4(clipX, clipY, clipZ, 1.0);       

    // calculates normal vector, fragment shader gets it.
    normalVec = mat3(NormalTr) * vertexNormal; 
    
    // calculate vectors toward light and eye -> send to fragment shader
    lightVec = lightPos - worldPos;
    eyeVec = EYE - worldPos;

    texCoord = vertexTexture; 
    tanVec = mat3(NormalTr) * vertexTangent;

    // vertex position in the light's POV
    shadowCoord = ShadowMatrix * ModelTr * vertex;
}
