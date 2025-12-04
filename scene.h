////////////////////////////////////////////////////////////////////////
// The scene class contains all the parameters needed to define and
// draw a simple scene, including:
//   * Geometry
//   * Light parameters
//   * Material properties
//   * Viewport size parameters
//   * Viewing transformation values
//   * others ...
//
// Some of these parameters are set when the scene is built, and
// others are set by the framework in response to user mouse/keyboard
// interactions.  All of them can be used to draw the scene.

#include "shapes.h"
#include "object.h"
#include "texture.h"
#include "fbo.h"

enum ObjectIds {
    nullId = 0,
    skyId = 1,
    seaId = 2,
    groundId = 3,
    roomId = 4,
    boxId = 5,
    frameId = 6,
    lPicId = 7,
    rPicId = 8,
    teapotId = 9,
    spheresId = 10,
    floorId = 11
};

class Shader;


class Scene
{
public:
    GLFWwindow* window;

    float lastTime;

    // @@ Declare interactive viewing variables here. (spin, tilt, ry, front back, ...)
    float spin, tilt;
    float tx, ty, zoom;
    float rx, ry;
    float front, back;

    glm::vec3 eye;
    float speed;

    bool w_down, a_down, s_down, d_down;
    bool transformationMode;

    // Light parameters
    float lightSpin, lightTilt, lightDist;
    glm::vec3 lightPos, lightColor, ambient;
    // @@ Perhaps declare additional scene lighting values here. (lightVal, lightAmb)

    float exposure; // Exposure control for tone mapping

    int mode; // Extra mode indicator hooked up to number keys and sent to shader

    // Viewport
    int width, height;

    // Transformations
    glm::mat4 WorldProj, WorldView, WorldInverse;

    // All objects in the scene are children of this single root object.
    Object* objectRoot;
    Object* central, * anim, * room, * floor, * teapot, * podium, * sky,
        * ground, * sea, * spheres, * leftFrame, * rightFrame;

    std::vector<Object*> animated;
    ProceduralGround* proceduralGround;
    Texture* skyTexture;

    HDRTexture* irradianceMap;

    // Shader programs
    ShaderProgram* lightingProgram;
    // @@ Declare additional shaders if necessary
    ShaderProgram* shadowProgram;
    ShaderProgram* reflectionProgram;

    FBO* shadowFBO;
    FBO* upperReflectionFBO;
    FBO* lowerReflectionFBO;



    // Options menu stuff
    bool show_demo_window;

    void InitializeScene();
    void BuildTransforms();
    void DrawMenu();
    void DrawScene();

    glm::mat4 LookAt(glm::vec3 pos, glm::vec3 lookDir, glm::vec3 upDir);
};