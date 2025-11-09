////////////////////////////////////////////////////////////////////////
// Fragment shader for shadow
//
// Copyright 2025 Rahul Nair - DigiPen Institute of Technology
////////////////////////////////////////////////////////////////////////
#version 330

in vec4 position;

out vec4 FragColor;

void main()
{
    // Output the depth (position.w contains the depth from light)
    // Only the w component will be used, but we output vec4 for compatibility
    FragColor = position;
}