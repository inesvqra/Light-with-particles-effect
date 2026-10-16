#version 450 core

// ----------------------------------------------------------------------------
// Input Variables
// ----------------------------------------------------------------------------
// The UBO with camera data.	
layout (std140, binding = 0) uniform CameraBuffer
{
	mat4 projection;		// The projection matrix.
	mat4 projection_inv;	// The inverse of the projection matrix.
	mat4 view;				// The view matrix
	mat4 view_inv;			// The inverse of the view matrix.
	mat3 view_it;			// The inverse of the transpose of the top-left part 3x3 of the view matrix
	vec3 eye_position;		// The position of the eye in world space.
};

struct Particle {
    vec4 position;   // xyz = position, w = not used
    vec3 velocity;   // xyz = velocity, w = not used
	int light_id;    // Light ID
    vec3 color;      // rgba = color
    float delay;     // Release delay in milliseconds
};

layout(std430, binding = 1) buffer ParticleBuffer {
    Particle particles[];
};

struct PhongLight
{
	vec4 position;                   // The position of the light. Note that position.w should be one for point lights and spot lights, and zero for directional lights.
	vec3 ambient;                    // The ambient part of the color of the light.
	vec3 diffuse;                    // The diffuse part of the color of the light.
	vec3 specular;                   // The specular part of the color of the light. 
	vec3 spot_direction;             // The direction of the spot light, irrelevant for point lights and directional lights.
	float spot_exponent;             // The spot exponent of the spot light, irrelevant for point lights and directional lights.
	float spot_cos_cutoff;           // The cosine of the spot light's cutoff angle, -1 point lights, irrelevant for directional lights.
	float atten_constant;            // The constant attenuation of spot lights and point lights, irrelevant for directional lights. For no attenuation, set this to 1.
	float atten_linear;              // The linear attenuation of spot lights and point lights, irrelevant for directional lights.  For no attenuation, set this to 0.
	float atten_quadratic;           // The quadratic attenuation of spot lights and point lights, irrelevant for directional lights. For no attenuation, set this to 0.
};

// The UBO with light data.
layout (std140, binding = 2) uniform PhongLightsBuffer
{
	vec3 global_ambient_color;		// The global ambient color.
	int lights_count;				// The number of lights in the buffer.
	PhongLight lights[3];			// The array with actual lights.
};

// Input variables
uniform vec3 gravity;               // Gravity vector
uniform float delta_time;           // Time step
uniform float light_radius; 

// ----------------------------------------------------------------------------
// Output Variables
// ----------------------------------------------------------------------------
out VertexData
{
	vec3 color;	       // The particle color.
	vec4 position_vs;  // The particle position in view space.
} out_data;

float Random_func(float p)  
{ //cambiar valores?
	p = fract(p * 0.1234);  
	p = p + 50.0;  
	p *= p + p;  
	return fract(p);  
} 
vec3 random_direction(float min, float max) {
    // Generar valores aleatorios en el rango [min, max]
    float u = mix(min, max, Random_func(gl_VertexID)); // Aleatorio en [min, max]
    float v = mix(min, max, Random_func(gl_VertexID * 1.234));

    // Convertir a coordenadas esféricas
    float theta = 2.0 * 3.14159265359 * u; // Ángulo en el plano XY
    float phi = acos(2.0 * v - 1.0);       // Ángulo desde el eje Z

    // Convertir a coordenadas cartesianas
    float x = sin(phi) * cos(theta);
    float y = sin(phi) * sin(theta);
    float z = cos(phi);

    return normalize(vec3(x, y, z)); // Devolver dirección normalizada
}


// ----------------------------------------------------------------------------
// Main Method
// ----------------------------------------------------------------------------
void main()
{
	Particle particle = particles[gl_VertexID];

	vec4 light_position = lights[particle.light_id].position;
	vec3 light_color = lights[particle.light_id].diffuse;
	if(particle.delay < 0 || particle.position.y < -1){
		vec3 rand_dir = random_direction(-1,1);
		rand_dir = normalize(rand_dir);
		particle.position = vec4(light_position.xyz + rand_dir * light_radius, 1.0f);
		particle.velocity = rand_dir * 1.5f;
		particle.color = light_color;
		// // Note that you need a long delay (at least in range 0-1000 ms)
		particle.delay = Random_func(gl_VertexID);
		particle.light_id = gl_VertexID % 3; //fixing memory alignment error -->particles dont distribute evenly

	}
	// Reducir el tiempo de vida de la partícula en función del tiempo transcurrido
	particle.delay -= delta_time;
	// // // Also do not forget to store the particle back into the buffer

	// Actualizar la posición de la partícula utilizando ecuaciones de movimiento con aceleración (gravedad)
	particle.position += vec4(particle.velocity, 0) * delta_time + 0.5f * vec4(gravity, 0) * delta_time * delta_time;
	// Actualizar la velocidad de la partícula bajo el efecto de la gravedad
	particle.velocity += gravity * delta_time;

	////Guardar la partícula actualizada de vuelta en el buffer
	particles[gl_VertexID] = particle;
	// Pasar los valores de salida al pipeline de rendering
	out_data.color = particle.color;
	out_data.position_vs = view * particle.position;
}