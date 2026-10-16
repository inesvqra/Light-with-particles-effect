#pragma once
#include "camera_ubo.hpp"
#include "light_ubo.hpp"
#include "pbr_material_ubo.hpp"
#include "pv227_application.hpp"
#include "ubo_impl.hpp" // required for UBO with snowman

/** The number of spheres forming the snowman. */
constexpr int snowman_size = 10;
constexpr int lightsspheres_size = 3;

struct Snowman {
    glm::vec4 spheres[snowman_size];         // The spheres defining the snowman.
    PBRMaterialData materials[snowman_size]; // The respective materials for each sphere.
};

struct LightSphere {
    glm::vec4 spheres[lightsspheres_size];         // The spheres defining the snowman.
    PBRMaterialData materials[lightsspheres_size]; // The respective materials for each sphere.
};

struct Particle {
    glm::vec4 position;   // xyz = position, w = not used
    glm::vec3 velocity;   // xyz = velocity, w = not used
    int light_id;    // Light ID
    glm::vec3 color;      // rgba = color
    float delay;     // Release delay in milliseconds
};

/** The definition of a snowman ubo. */
class SnowmanUBO : public UBO<Snowman> {
    using UBO<Snowman>::UBO; // copies constructors from the parent class
};

class LightSphereUBO : public UBO<LightSphere> {
    using UBO<LightSphere>::UBO; // copies constructors from the parent class
};

class Application : public PV227Application {
    // ----------------------------------------------------------------------------
    // Variables (Geometry)
    // ----------------------------------------------------------------------------
    std::vector<glm::vec4> spheres;
   
    // ----------------------------------------------------------------------------
    // Variables (Materials)
    // ----------------------------------------------------------------------------
protected:
    /** The UBO storing the data about the materials for each sphere. */
    PBRMaterialUBO materials_ubo;
  protected:
    /** The definition of the snowman. */
    Snowman snowman;
    LightSphere lightSphere;
    /** The buffer with the snowman. */
    SnowmanUBO snowman_ubo;
    LightSphereUBO lightSpheres_ubo;

protected:
    // ----------------------------------------------------------------------------
    // Variables (Textures)
    // ----------------------------------------------------------------------------
    /** The program for rendering particles as a textured quad (generated in compute shader). */
    ShaderProgram particle_textured_program;
    /** The simple program for updating particles. */
    ShaderProgram update_particles_program;

  protected:
    // ----------------------------------------------------------------------------
    // Variables (Light)
    // ----------------------------------------------------------------------------
  protected:
    /** The UBO storing the data about lights - positions, colors, etc. */
    PhongLightsUBO phong_lights_ubo;
    /** The UBO defining a material that is used for lights during rasterization. */
    PhongMaterialUBO light_material_ubo;

    // ----------------------------------------------------------------------------
    // Variables (Camera)
    // ----------------------------------------------------------------------------
  protected:
    /** The UBO storing the information about camera. */
    CameraUBO camera_ubo;

    // ----------------------------------------------------------------------------
    // Variables (Shaders)
    // ----------------------------------------------------------------------------
  protected:
    ShaderProgram ray_tracing_program;

    // ----------------------------------------------------------------------------
    //Particles
    // ----------------------------------------------------------------------------
  protected:
  /** The framebuffer object that is used when rendering into the G-buffer. */
    std::vector<Particle> particles;
    int max_particle_count = 131072;
    GLuint particle_buffer;
    float delta_time = 0.005f;
    glm::vec3 gravity = glm::vec3(0.0f,-9.8f,0.0f);
    float particle_size_vs = 0.1f;
    GLuint particle_tex;

    // std::vector<glm::vec3>ssaoKernel;

    // const int kernelSize = 16;

    // ----------------------------------------------------------------------------
    // Variables (Frame Buffers)
    // ----------------------------------------------------------------------------
  protected:  
    // ----------------------------------------------------------------------------
    // Variables (GUI)
    // ----------------------------------------------------------------------------
    int iterations = 3;
    /** The flag determining if SSAO should be blurred. */
    bool blur_ssao = true;
    /** The radius used when computing the SSAO. */
    float ssao_radius = 2.0f;
  protected:
    /** The number of iterations. */
    int reflections = 3;

    /** The desired snow particle count. */
    int desired_snow_count = 4096;

    /** The current snow particle count. */
    int current_snow_count = 256;

    /** The flag determining if a snow should be visible. */
    bool show_particles = true;

    /** The number of shadow samples. */
    int shadow_samples = 16;

    /** The flag determining if an area light should be present. */
    float sphere_light_radius = 0.5f;

    /** The flag determining if the ambient occlusion should be used. */
    bool corrective_use_ambient_occlusion = true;

    
    // ----------------------------------------------------------------------------
    // Constructors
    // ----------------------------------------------------------------------------
  public:
    Application(int initial_width, int initial_height, std::vector<std::string> arguments = {});

    /** Destroys the {@link Application} and releases the allocated resources. */
    virtual ~Application();

    // ----------------------------------------------------------------------------
    // Shaders
    // ----------------------------------------------------------------------------
    /**
     * {@copydoc PV227Application::compile_shaders}
     */
    void compile_shaders() override;

    // ----------------------------------------------------------------------------
    // Initialize Scene
    // ----------------------------------------------------------------------------
  public:
    /** Prepares the required cameras. */
    void prepare_cameras();

    /** Prepares the required materials. */
    void prepare_materials();

    /** Prepares the required textures. */
    void prepare_textures();

    /** Prepares the lights. */
    void prepare_lights();

    /** Builds a snowman from individual parts. */
    void prepare_snowman();

    /** Prepares the scene objects. */
    void prepare_scene();

    /** Prepares the frame buffer objects. */
    void prepare_framebuffers();

    /** Resizes the full screen textures match the window. */
    void resize_fullscreen_textures();

    // ----------------------------------------------------------------------------
    // Update
    // ----------------------------------------------------------------------------
    /**
     * Converts color in HSV to RGB.
     *
     * @param 	h	The hue [0-360].
     * @param 	s	The saturation [0-1].
     * @param 	v	The value [0-1].
     *
     * @return	The converted RGC color.
     */
    glm::vec3 HSVtoRGB(float h, float s, float v);

    /**
     * {@copydoc PV227Application::update}
     */
    void update(float delta) override;

    // ----------------------------------------------------------------------------
    // Render
    // ----------------------------------------------------------------------------
  public:
    /** @copydoc PV227Application::render */
    void render() override;

    /** Renders the snowman using rasterization. */
    void raster_snowman();
    // ----------------------------------------------------------------------------
    // GUI
    // ----------------------------------------------------------------------------
  public:
    /** @copydoc PV227Application::render_ui */
    void render_ui() override;

  void ray_tracing_gpu();
  void update_particle_count();
    // ----------------------------------------------------------------------------
    // Input Events
    // ----------------------------------------------------------------------------
  public:
    /** @copydoc PV227Application::on_resize */
    void on_resize(int width, int height) override;
};
