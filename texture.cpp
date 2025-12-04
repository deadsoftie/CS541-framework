///////////////////////////////////////////////////////////////////////
// A slight encapsulation of an OpenGL texture. This contains a method
// to read an image file into a texture, and methods to bind a texture
// to a shader for use, and unbind when done.
////////////////////////////////////////////////////////////////////////

#include <cstdlib>

#include <glbinding/gl/gl.h>
#include <glbinding/Binding.h>
using namespace gl;

#define GLM_FORCE_CTOR_INIT
#define GLM_FORCE_RADIANS
#define GLM_SWIZZLE

#include "texture.h"

#define STB_IMAGE_IMPLEMENTATION
#define STBI_FAILURE_USERMSG
#include "stb_image.h"

#define CHECKERROR {GLenum err = glGetError(); if (err != GL_NO_ERROR) { fprintf(stderr, "OpenGL error (at line texture.cpp:%d): %s\n", __LINE__, gluErrorString(err)); exit(-1);} }

Texture::Texture() : textureId(0), width(0), height(0), depth(0), image(nullptr)
{
}

Texture::Texture(const std::string &path) : textureId(0)
{
    stbi_set_flip_vertically_on_load(true);
    image = stbi_load(path.c_str(), &width, &height, &depth, 4);
    printf("%d %d %d %s\n", depth, width, height, path.c_str());
    if (!image) {
        printf("\nRead error on file %s:\n  %s\n\n", path.c_str(), stbi_failure_reason());
        exit(-1); }

    glGenTextures(1, &textureId);   // Get an integer id for this texture from OpenGL
    glBindTexture(GL_TEXTURE_2D, textureId);
    glTexImage2D(GL_TEXTURE_2D, 0, static_cast<GLint>(GL_RGBA), width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, image);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAX_LEVEL, 10);
    glGenerateMipmap(GL_TEXTURE_2D);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, static_cast<int>(GL_LINEAR));

    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, static_cast<int>(GL_LINEAR_MIPMAP_LINEAR));  
    glBindTexture(GL_TEXTURE_2D, 0);
    stbi_image_free(image);
}

HDRTexture::HDRTexture()
= default;

HDRTexture::HDRTexture(const std::string& path)
{
    stbi_set_flip_vertically_on_load(true);
    float* image = stbi_loadf(path.c_str(), &width, &height, &depth, 4);
    printf("%d %d %d %s\n", depth, width, height, path.c_str());
    if (!image) {
        printf("\nRead error on file %s:\n  %s\n\n", path.c_str(), stbi_failure_reason());
        exit(-1);
    }

    glGenTextures(1, &textureId);   // Get an integer id for this texture from OpenGL
    glBindTexture(GL_TEXTURE_2D, textureId);
    glTexImage2D(GL_TEXTURE_2D, 0, static_cast<GLint>(GL_RGBA), width, height, 0, GL_RGBA, GL_FLOAT, image);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAX_LEVEL, 10);
    glGenerateMipmap(GL_TEXTURE_2D);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, static_cast<int>(GL_LINEAR));

    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, static_cast<int>(GL_LINEAR_MIPMAP_LINEAR));
    glBindTexture(GL_TEXTURE_2D, 0);
    stbi_image_free(image);
}


// Make a texture availabe to a shader program.  The unit parameter is
// a small integer specifying which texture unit should load the
// texture.  The name parameter is the sampler2d in the shader program
// which will provide access to the texture.
void Texture::BindTexture(const int unit, const int programId, const std::string& name) const
{
    glActiveTexture(static_cast<gl::GLenum>(static_cast<int>(GL_TEXTURE0) + unit));
    glBindTexture(GL_TEXTURE_2D, textureId);
    int loc = glGetUniformLocation(programId, name.c_str());
    glUniform1i(loc, unit);
}

// Unbind a texture from a texture unit whne no longer needed.
void Texture::UnbindTexture(const int unit)
{  
    glActiveTexture(static_cast<gl::GLenum>(static_cast<int>(GL_TEXTURE0) + unit));
    glBindTexture(GL_TEXTURE_2D, 0);
}

