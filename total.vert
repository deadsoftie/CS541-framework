/////////////////////////////////////////////////////////////////////////
// Vertex shader for lighting
//
// Copyright 2013 DigiPen Institute of Technology
////////////////////////////////////////////////////////////////////////
#version 330

uniform mat4 ModelTr, NormalTr;
uniform mat4 WorldView, WorldInverse, WorldProj; 
uniform mat4 ShadowMatrix;

in vec4 vertex;
in vec3 vertexNormal;
in vec2 vertexTexture;
in vec3 vertexTangent;

out vec3 normalVec, lightVec, eyeVec, tanVec;
out vec2 texCoord;
out vec4 shadowCoord;

uniform vec3 lightPos;

void main()
{     
    // projection position
    gl_Position = WorldProj*WorldView*ModelTr*vertex;       
    
    // world position(used for light and vector calculations)
    vec3 worldPos = (ModelTr*vertex).xyz;

    // calculates normal vector, fragment shader gets it.
    normalVec = vertexNormal*mat3(NormalTr); 
    tanVec = vertexTangent * mat3(NormalTr);
    
    // calculate vectors toward light and eye -> send to fragment shader
    lightVec = lightPos - worldPos;
    vec3 eyePos = (WorldInverse * vec4(0, 0, 0, 1)).xyz;    
    eyeVec = eyePos - worldPos;

    texCoord = vertexTexture; 
    // vertex position in the light's POV
    shadowCoord = ShadowMatrix * ModelTr * vertex;
}
