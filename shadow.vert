////////////////////////////////////////////////////////////////////////
// Vertex shader for shadow
//
// Copyright 2025 Rahul Nair - DigiPen Institute of Technology
////////////////////////////////////////////////////////////////////////
#version 330

uniform mat4 LightViewProj;  // Combined P_L * V_L
uniform mat4 ModelTr;

in vec4 vertex;

out vec4 position;

void main()
{      
    // Transform vertex to light's clip space
    gl_Position = LightViewProj * ModelTr * vertex;
    
    // Pass position for depth calculation in fragment shader
    position = gl_Position;
}