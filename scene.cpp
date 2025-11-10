////////////////////////////////////////////////////////////////////////
// The scene class contains all the parameters needed to define and
// draw a simple scene, including:
//   * Geometry
//   * Light parameters
//   * Material properties
//   * viewport size parameters
//   * Viewing transformation values
//   * others ...
//
// Some of these parameters are set when the scene is built, and
// others are set by the framework in response to user mouse/keyboard
// interactions.  All of them can be used to draw the scene.

#include <iostream>
#include <stdlib.h>

#include <glbinding/gl/gl.h>
#include <glbinding/Binding.h>
using namespace gl;

#include <glu.h> // For gluErrorString

#define GLM_FORCE_CTOR_INIT
#define GLM_FORCE_RADIANS
#define GLM_SWIZZLE
#include <glm/glm.hpp>
#include <glm/ext.hpp> // For printing GLM objects with to_string

#include "framework.h"
#include "shapes.h"
#include "object.h"
#include "texture.h"
#include "transform.h"
const bool fullPolyCount = true; // Use false when emulating the graphics pipeline in software

const float PI = 3.14159f;
const float rad = PI / 180.0f; // Convert degrees to radians

glm::mat4 Identity(1.0);

const float grndSize = 100.0;       // Island radius;  Minimum about 20;  Maximum 1000 or so
const float grndOctaves = 4.0;      // Number of levels of detail to compute
const float grndFreq = 0.03;        // Number of hills per (approx) 50m
const float grndPersistence = 0.03; // Terrain roughness: Slight:0.01  rough:0.05
const float grndLow = -3.0;         // Lowest extent below sea level
const float grndHigh = 5.0;         // Highest extent above sea level

////////////////////////////////////////////////////////////////////////
// This macro makes it easy to sprinkle checks for OpenGL errors
// throughout your code.  Most OpenGL calls can record errors, and a
// careful programmer will check the error status *often*, perhaps as
// often as after every OpenGL call.  At the very least, once per
// refresh will tell you if something is going wrong.
#define CHECKERROR                                                                                       \
    {                                                                                                    \
        GLenum err = glGetError();                                                                       \
        if (err != GL_NO_ERROR)                                                                          \
        {                                                                                                \
            fprintf(stderr, "OpenGL error (at line scene.cpp:%d): %s\n", __LINE__, gluErrorString(err)); \
            exit(-1);                                                                                    \
        }                                                                                                \
    }

// Create an RGB color from human friendly parameters: hue, saturation, value
glm::vec3 HSV2RGB(const float h, const float s, const float v)
{
    if (s == 0.0)
        return glm::vec3(v, v, v);

    int i = (int)(h * 6.0) % 6;
    float f = (h * 6.0f) - i;
    float p = v * (1.0f - s);
    float q = v * (1.0f - s * f);
    float t = v * (1.0f - s * (1.0f - f));
    if (i == 0)
        return glm::vec3(v, t, p);
    else if (i == 1)
        return glm::vec3(q, v, p);
    else if (i == 2)
        return glm::vec3(p, v, t);
    else if (i == 3)
        return glm::vec3(p, q, v);
    else if (i == 4)
        return glm::vec3(t, p, v);
    else /*i == 5*/
        return glm::vec3(v, p, q);
}

////////////////////////////////////////////////////////////////////////
// Constructs a hemisphere of spheres of varying hues
Object* SphereOfSpheres(Shape* SpherePolygons)
{
    Object* ob = new Object(NULL, nullId);

    for (float angle = 0.0; angle < 360.0; angle += 18.0)
        for (float row = 0.075; row < PI / 2.0; row += PI / 2.0 / 6.0)
        {
            glm::vec3 hue = HSV2RGB(angle / 360.0, 1.0f - 2.0f * row / PI, 1.0f);

            Object* sp = new Object(SpherePolygons, spheresId,
                hue, glm::vec3(1.0, 1.0, 1.0), 120.0);
            float s = sin(row);
            float c = cos(row);
            ob->add(sp, Rotate(2, angle) * Translate(c, 0, s) * Scale(0.075 * c, 0.075 * c, 0.075 * c));
        }
    return ob;
}

////////////////////////////////////////////////////////////////////////
// Constructs a -1...+1  quad (canvas) framed by four (elongated) boxes
Object* FramedPicture(const glm::mat4& modelTr, const int objectId,
    Shape* BoxPolygons, Shape* QuadPolygons, Texture* pictureTexture)
{
    // This draws the frame as four (elongated) boxes of size +-1.0
    float w = 0.05; // Width of frame boards.

    Object* frame = new Object(NULL, nullId);
    Object* ob;

    glm::vec3 woodColor(87.0 / 255.0, 51.0 / 255.0, 35.0 / 255.0);
    ob = new Object(BoxPolygons, frameId,
        woodColor, glm::vec3(0.2, 0.2, 0.2), 10.0);
    frame->add(ob, Translate(0.0, 0.0, 1.0 + w) * Scale(1.0, w, w));
    frame->add(ob, Translate(0.0, 0.0, -1.0 - w) * Scale(1.0, w, w));
    frame->add(ob, Translate(1.0 + w, 0.0, 0.0) * Scale(w, w, 1.0 + 2 * w));
    frame->add(ob, Translate(-1.0 - w, 0.0, 0.0) * Scale(w, w, 1.0 + 2 * w));

    ob = new Object(QuadPolygons, objectId,
        woodColor, glm::vec3(0.0, 0.0, 0.0), 10.0, pictureTexture);
    frame->add(ob, Rotate(0, 90));

    return frame;
}

////////////////////////////////////////////////////////////////////////
// InitializeScene is called once during setup to create all the
// textures, shape VAOs, and shader programs as well as setting a
// number of other parameters.
void Scene::InitializeScene()
{
    glEnable(GL_DEPTH_TEST);
    CHECKERROR;

    // @@ Initialize interactive viewing variables here. (spin, tilt, ry, front back, ...)
    spin = 0;
    tilt = 30;

    tx = 0;
    ty = 0;
    zoom = 25;

    ry = 0.4f;

    front = 0.5f;
    back = 5000;

    // Game-like navigation
    eye = { 0, -20, 0 };
    speed = 10;

    // Set initial light parameters
    lightSpin = 150.0;
    lightTilt = -45.0;
    lightDist = 100.0;
    // @@ Perhaps initialize additional scene lighting values here. (lightVal, lightAmb)
    lightVal = { 3.0, 3.0, 3.0 };
    lightAmb = { 0.15, 0.15, 0.15 };

    CHECKERROR;
    objectRoot = new Object(NULL, nullId);

    // Enable OpenGL depth-testing
    glEnable(GL_DEPTH_TEST);

    // Create the lighting shader program from source code files.
    // @@ Initialize additional shaders if necessary

    // LIGHTING SHADERS
    lightingProgram = new ShaderProgram();
    lightingProgram->AddShader("lighting.vert", GL_VERTEX_SHADER);
    lightingProgram->AddShader("lighting.frag", GL_FRAGMENT_SHADER);

    glBindAttribLocation(lightingProgram->programId, 0, "vertex");
    glBindAttribLocation(lightingProgram->programId, 1, "vertexNormal");
    glBindAttribLocation(lightingProgram->programId, 2, "vertexTexture");
    glBindAttribLocation(lightingProgram->programId, 3, "vertexTangent");
    lightingProgram->LinkProgram();

    // SHADOW SHADERS
    shadowProgram = new ShaderProgram();
    shadowProgram->AddShader("shadow.vert", GL_VERTEX_SHADER);
    shadowProgram->AddShader("shadow.frag", GL_FRAGMENT_SHADER);

    glBindAttribLocation(shadowProgram->programId, 0, "vertex");
    shadowProgram->LinkProgram();

    // Create shadow map FBO
    shadowFBO = new FBO();
    shadowFBO->CreateFBO(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);

    // Create all the Polygon shapes
    proceduralGround = new ProceduralGround(grndSize, 400,
        grndOctaves, grndFreq, grndPersistence,
        grndLow, grndHigh);

    Shape* TeapotPolygons = new Teapot(fullPolyCount ? 12 : 2);
    Shape* BoxPolygons = new Box();
    Shape* SpherePolygons = new Sphere(32);
    Shape* RoomPolygons = new Ply("room.ply");
    Shape* FloorPolygons = new Plane(10.0, 10);
    Shape* QuadPolygons = new Quad();
    Shape* SeaPolygons = new Plane(2000.0, 50);
    Shape* GroundPolygons = proceduralGround;

    // Various colors used in the subsequent models
    glm::vec3 woodColor(87.0 / 255.0, 51.0 / 255.0, 35.0 / 255.0);
    glm::vec3 brickColor(134.0 / 255.0, 60.0 / 255.0, 56.0 / 255.0);
    glm::vec3 floorColor(6 * 16 / 255.0, 5.5 * 16 / 255.0, 3 * 16 / 255.0);
    glm::vec3 brassColor(0.5, 0.5, 0.1);
    glm::vec3 grassColor(62.0 / 255.0, 102.0 / 255.0, 38.0 / 255.0);
    glm::vec3 waterColor(0.3, 0.3, 1.0);

    // Ks values in a range appropriate range for BRDF calculations. (Phong needs 10* this.)
    glm::vec3 noSpec(0.0, 0.0, 0.0);
    glm::vec3 brightSpec(0.03, 0.03, 0.03);

    // Creates all the models from which the scene is composed.  Each
    // is created with a polygon shape (possibly NULL), a
    // transformation, and the surface lighting parameters Kd, Ks, and
    // alpha.

    // @@ This is where you could read in all the textures and
    // associate them with the various objects being created in the
    // next dozen lines of code.

    Texture* brickTexture = new Texture("textures/Standard_red_pxr128.png");
    Texture* brickNormalMap = new Texture("textures/Standard_red_pxr128_normal.png");

    Texture* woodTexture = new Texture("textures/Brazilian_rosewood_pxr128.png");
    Texture* woodNormalMap = new Texture("textures/Brazilian_rosewood_pxr128_normal.png");

    Texture* cracksTexture = new Texture("textures/cracks.png");

    Texture* grassTexture = new Texture("textures/grass.jpg");

    Texture* floorTexture = new Texture("textures/6670-diffuse.jpg");
    Texture* floorNormalMap = new Texture("textures/6670-normal.jpg");

    Texture* rightPicTexture = new Texture("textures/my-house-01.png");

    Texture* waterRippleNormalMap = new Texture("textures/ripples_normalmap.png");

    Texture* skyTexture = new Texture("skys/Tropical_Beach_8k.jpg");

    // @@ To change an object's surface parameters (Kd, Ks, or alpha),
    // modify the following lines.

    central = new Object(NULL, nullId);
    anim = new Object(NULL, nullId);
    room = new Object(RoomPolygons, roomId, brickColor, noSpec, 1, brickTexture, brickNormalMap);
    floor = new Object(FloorPolygons, floorId, floorColor, brightSpec, 10, floorTexture, floorNormalMap);
    floor->reflectionStrength = 0.1;
    teapot = new Object(TeapotPolygons, teapotId, brassColor, brightSpec, 120, cracksTexture);
    teapot->reflectionStrength = 0.1;
    podium = new Object(BoxPolygons, boxId, glm::vec3(woodColor), brightSpec, 10, woodTexture, woodNormalMap);
    sky = new Object(SpherePolygons, skyId, noSpec, noSpec, 0, skyTexture);
    ground = new Object(GroundPolygons, groundId, grassColor, noSpec, 1, grassTexture);
    sea = new Object(SeaPolygons, seaId, waterColor, brightSpec, 120, skyTexture, waterRippleNormalMap);
    sea->reflectionStrength = 1.0;
    leftFrame = FramedPicture(Identity, lPicId, BoxPolygons, QuadPolygons, NULL);
    rightFrame = FramedPicture(Identity, rPicId, BoxPolygons, QuadPolygons, rightPicTexture);
    spheres = SphereOfSpheres(SpherePolygons);
#ifdef REFL
    spheres->drawMe = true;
#else
    spheres->drawMe = true; // TODO: Return back to false after testing is completed
#endif

    // @@ To change the scene hierarchy, examine the hierarchy created
    // by the following object->add() calls and adjust as you wish.
    // The objects being manipulated and their polygon shapes are
    // created above here.

    // Scene is composed of sky, ground, sea, room and some central models
    if (fullPolyCount)
    {
        objectRoot->add(sky, Scale(2000.0, 2000.0, 2000.0));
        objectRoot->add(sea);
        objectRoot->add(ground);
    }
    objectRoot->add(central);
#ifndef REFL
    objectRoot->add(room, Translate(0.0, 0.0, 0.02));
#endif
    objectRoot->add(floor, Translate(0.0, 0.0, 0.02));

    // Central model has a rudimentary animation (constant rotation on Z)
    animated.push_back(anim);

    // Central contains a teapot on a podium and an external sphere of spheres
    central->add(podium, Translate(0.0, 0, 0));
    central->add(anim, Translate(0.0, 0, 0));
    anim->add(teapot, Translate(0, 0, 1) * Scale(0.31, 0.31, 0.31));

    if (fullPolyCount)
        anim->add(spheres, Translate(0.0, 0.0, 0.0) * Scale(16, 16, 16));

    // Room contains two framed pictures
    if (fullPolyCount)
    {
        room->add(leftFrame, Translate(-1.5, 9.85, 1.) * Scale(0.8, 0.8, 0.8));
        room->add(rightFrame, Translate(1.5, 9.85, 1.) * Scale(0.8, 0.8, 0.8));
    }

    CHECKERROR;

    // Options menu stuff
    show_demo_window = false;
}

void Scene::DrawMenu()
{
    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplGlfw_NewFrame();
    ImGui::NewFrame();

    if (ImGui::BeginMainMenuBar())
    {
        // This menu demonstrates how to provide the user a list of toggleable settings.
        if (ImGui::BeginMenu("Objects"))
        {
            if (ImGui::MenuItem("Draw spheres", "", spheres->drawMe))
            {
                spheres->drawMe ^= true;
            }
            if (ImGui::MenuItem("Draw walls", "", room->drawMe))
            {
                room->drawMe ^= true;
            }
            if (ImGui::MenuItem("Draw ground/sea", "", ground->drawMe))
            {
                ground->drawMe ^= true;
                sea->drawMe = ground->drawMe;
            }
            ImGui::EndMenu();
        }

        // This menu demonstrates how to provide the user a choice
        // among a set of choices.  The current choice is stored in a
        // variable named "mode" in the application, and sent to the
        // shader to be used as you wish.
        if (ImGui::BeginMenu("Menu "))
        {
            if (ImGui::MenuItem("<sample menu of choices>", "", false, false))
            {
            }
            if (ImGui::MenuItem("Do nothing 0", "", mode == 0))
            {
                mode = 0;
            }
            if (ImGui::MenuItem("Do nothing 1", "", mode == 1))
            {
                mode = 1;
            }
            if (ImGui::MenuItem("Do nothing 2", "", mode == 2))
            {
                mode = 2;
            }
            ImGui::EndMenu();
        }

        ImGui::EndMainMenuBar();
    }
    ImGui::Render();
    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
}

void Scene::BuildTransforms()
{
    // @@ When you are ready to try interactive viewing, replace the
    // following hard coded values for WorldProj and WorldView with
    // transformation matrices calculated from variables such as spin,
    // tilt, tr, ry, front, and back.

    rx = ry * (float)width / (float)height;

    if (transformationMode == true)
    {
        WorldView = Rotate(0, tilt - 90) * Rotate(2, spin) * Translate(-eye.x, -eye.y, -eye.z);
        WorldProj = Perspective(rx, ry, front, back);
    }
    else
    {
        WorldView = Translate(tx, ty, -zoom) * Rotate(0, tilt - 90) * Rotate(2, spin);
        WorldProj = Perspective(rx, ry, front, back);
    }

    // @@ Print the two matrices (in column-major order) for
    // comparison with the project document.
    // std::cout << "WorldView: " << glm::to_string(WorldView) << std::endl;
    // std::cout << "WorldProj: " << glm::to_string(WorldProj) << std::endl;
}

////////////////////////////////////////////////////////////////////////
// Procedure DrawScene is called whenever the scene needs to be
// drawn. (Which is often: 30 to 60 times per second are the common
// goals.)
void Scene::DrawScene()
{
    static double prevTime = glfwGetTime();
    const double currTime = glfwGetTime();
    const double time_since_last_refresh = currTime - prevTime;
    prevTime = currTime;
    const float step = speed * time_since_last_refresh; // Frame-independent movement
    if (w_down)
        eye += step * glm::vec3(sin(spin * rad), cos(spin * rad), 0.0);
    if (a_down)
        eye -= step * glm::vec3(cos(spin * rad), -sin(spin * rad), 0.0);
    if (s_down)
        eye -= step * glm::vec3(sin(spin * rad), cos(spin * rad), 0.0);
    if (d_down)
        eye += step * glm::vec3(cos(spin * rad), -sin(spin * rad), 0.0);

    // Constant eye height relative to the ground
    const float eyeHeight = 2.0f;
    const float groundZ = proceduralGround->HeightAt(eye.x, eye.y);
    eye.z = groundZ + eyeHeight;

    // Set the viewport
    glfwGetFramebufferSize(window, &width, &height);

    CHECKERROR;
    // Calculate the light's position from lightSpin, lightTilt, lightDist
    lightPos = glm::vec3(lightDist * cos(lightSpin * rad) * sin(lightTilt * rad),
        lightDist * sin(lightSpin * rad) * sin(lightTilt * rad),
        lightDist * cos(lightTilt * rad));

    // Update position of any continuously animating objects
    const double atime = 360.0 * glfwGetTime() / 36;
    for (auto m = animated.begin(); m < animated.end(); ++m)
        (*m)->animTr = Rotate(2, atime);

    BuildTransforms();

    // The lighting algorithm needs the inverse of the WorldView matrix
    WorldInverse = glm::inverse(WorldView);

    ////////////////////////////////////////////////////////////////////////////////
    // Anatomy of a pass:
    //   Choose a shader  (create the shader in InitializeScene above)
    //   Choose and FBO/Render-Target (if needed; create the FBO in InitializeScene above)
    //   Set the viewport (to the pixel size of the screen or FBO)
    //   Clear the screen.
    //   Set the uniform variables required by the shader
    //   Draw the geometry
    //   Unset the FBO (if one was used)
    //   Unset the shader
    ////////////////////////////////////////////////////////////////////////////////

    CHECKERROR;
    int loc, programId;

    ////////////////////////////////////////////////////////////////////////////////
    // PASS 1: Shadow Map Generation (from light's POV)
    ////////////////////////////////////////////////////////////////////////////////

    shadowProgram->UseShader();
    programId = shadowProgram->programId;

    // Bind the FBO to render to shadow map texture
    shadowFBO->BindFBO();

    // Set viewport to shadow map size
    glViewport(0, 0, SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    // Create transformations from light's point of view
    glm::vec3 lightLookAt = glm::vec3(0.0f, 0.0f, 0.0f);  // Light looks at origin
    glm::vec3 upDir = glm::vec3(0.0f, 0.0f, 1.0f);

    // Create LookAt matrix for light (V_L)
    glm::mat4 lightView = glm::lookAt(lightPos, lightLookAt, upDir);

    // Create perspective projection for light (P_L)
    // Adjust these parameters to control shadow map coverage
    float lightFOV = 60.0f * rad;
    float lightAspect = 1.0f;
    float lightNear = 1.0f;
    float lightFar = 200.0f;
    glm::mat4 lightProj = glm::perspective(lightFOV, lightAspect, lightNear, lightFar);

    // Combined light view-projection matrix (P_L * V_L)
    glm::mat4 lightViewProj = lightProj * lightView;

    // Send combined matrix to shadow shader
    loc = glGetUniformLocation(programId, "LightViewProj");
    glUniformMatrix4fv(loc, 1, GL_FALSE, Pntr(lightViewProj));

    // Enable front-face culling to reduce shadow acne
    glEnable(GL_CULL_FACE);
    glCullFace(GL_FRONT);

    // Draw all geometry from light's POV (this creates the shadow map)
    CHECKERROR;
    objectRoot->Draw(shadowProgram, Identity);
    CHECKERROR;

    // Disable culling
    glDisable(GL_CULL_FACE);

    // Unbind FBO (back to default framebuffer)
    shadowFBO->UnbindFBO();

    // Unuse shadow shader
    shadowProgram->UnuseShader();

    CHECKERROR;

    ////////////////////////////////////////////////////////////////////////////////
    // PASS 2: Lighting with Shadows (from eye's POV)
    ////////////////////////////////////////////////////////////////////////////////

    // Choose the lighting shader
    lightingProgram->UseShader();
    programId = lightingProgram->programId;

    // Set the viewport to screen size, and clear the screen
    glViewport(0, 0, width, height);
    glClearColor(0.5, 0.5, 0.5, 1.0);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    // @@ The scene specific parameters (uniform variables) used by
    // the shader are set here.  Object specific parameters are set in
    // the Draw procedure in object.cpp

    loc = glGetUniformLocation(programId, "WorldProj");
    glUniformMatrix4fv(loc, 1, GL_FALSE, Pntr(WorldProj));
    loc = glGetUniformLocation(programId, "WorldView");
    glUniformMatrix4fv(loc, 1, GL_FALSE, Pntr(WorldView));
    loc = glGetUniformLocation(programId, "WorldInverse");
    glUniformMatrix4fv(loc, 1, GL_FALSE, Pntr(WorldInverse));
    loc = glGetUniformLocation(programId, "lightPos");
    glUniform3fv(loc, 1, &(lightPos[0]));
    loc = glGetUniformLocation(programId, "lightVal");
    glUniform3fv(loc, 1, &(lightVal[0]));
    loc = glGetUniformLocation(programId, "lightAmb");
    glUniform3fv(loc, 1, &(lightAmb[0]));
    loc = glGetUniformLocation(programId, "mode");
    glUniform1i(loc, mode);

    // Create shadow matrix: B * P_L * V_L
    // B transforms from [-1,1] NDC space to [0,1] texture space
    // B = Translate(0.5, 0.5, 0.5) * Scale(0.5, 0.5, 0.5)
    glm::mat4 biasMatrix(
        0.5f, 0.0f, 0.0f, 0.0f,
        0.0f, 0.5f, 0.0f, 0.0f,
        0.0f, 0.0f, 0.5f, 0.0f,
        0.5f, 0.5f, 0.5f, 1.0f
    );
    glm::mat4 shadowMatrix = biasMatrix * lightViewProj;

    // Send shadow matrix to lighting shader
    loc = glGetUniformLocation(programId, "ShadowMatrix");
    glUniformMatrix4fv(loc, 1, GL_FALSE, Pntr(shadowMatrix));

    CHECKERROR;

    // Bind skybox texture (texture unit 2)
    sky->texture->BindTexture(2, programId, "skyboxTexture");

    // Bind shadow map texture (texture unit 3, avoiding 0 and 1 as per instructions)
    shadowFBO->BindTexture(3, programId, "shadowMap");

    // Draw all objects (This recursively traverses the object hierarchy.)
    CHECKERROR;
    objectRoot->Draw(lightingProgram, Identity);
    CHECKERROR;

    // Unbind textures
    sky->texture->UnbindTexture(2);
    shadowFBO->UnbindTexture(3);

    // Turn off the shader
    lightingProgram->UnuseShader();

    ////////////////////////////////////////////////////////////////////////////////
    // End of rendering passes
    ////////////////////////////////////////////////////////////////////////////////
}