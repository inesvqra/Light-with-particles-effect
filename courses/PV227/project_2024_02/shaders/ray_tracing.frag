#version 450 core

// ----------------------------------------------------------------------------
// Input Variables
// ----------------------------------------------------------------------------
in VertexData
{
	vec2 tex_coord;
} in_data;

// The UBO with camera data.
layout (std140, binding = 0) uniform CameraBuffer
{
	mat4 projection;	  // The projection matrix.
	mat4 projection_inv;  // The inverse of the projection matrix.
	mat4 view;			  // The view matrix
	mat4 view_inv;		  // The inverse of the view matrix.
	mat3 view_it;		  // The inverse of the transpose of the top-left part 3x3 of the view matrix
	vec3 eye_position;	  // The position of the eye in world space.
};

// The structure holding the information about a single Phong light.
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
	PhongLight lights[8];			// The array with actual lights.
};

// The material data.
struct PBRMaterialData
{
   vec3 diffuse;     // The diffuse color of the material.
   float roughness;  // The roughness of the material.
   vec3 f0;          // The Fresnel reflection at 0°.
};

// The buffer with spheres snowman.
layout (std140, binding = 3) uniform SnowmanBuffer
{
    vec4 spheres[10];
    PBRMaterialData materials[10];
};

// The buffer with spheres light balls.
layout (std140, binding = 4) uniform LightBuffer
{
	vec4 spheresLights[3];
	PBRMaterialData lightsMaterials[3];
};

// The windows size.
uniform vec2 resolution;
// The number of spheres to render.
uniform int spheres_count;
// The number of iterations.
uniform int iterations;
//for soft shadows
uniform int shadow_samples;
//radius of light balls
uniform float sphere_light_radius;
// The number of spheres of light to render.
uniform int lights_spheres_count;
float real_distance = 1e20;

uniform bool use_ambient_occlusion;


// The skybox texture.
layout (binding = 0) uniform samplerCube skybox_tex;

/** The flag determining if a tone mapping should be used. */
uniform bool use_tone_mapping;
/** The exposure value. */
uniform float exposure;
/** The gamma value. */
uniform float gamma;

uniform float time;

// ----------------------------------------------------------------------------
// Output Variables
// ----------------------------------------------------------------------------
layout (location = 0) out vec4 final_color;

// ----------------------------------------------------------------------------
// Ray Tracing Structures
// ----------------------------------------------------------------------------
struct Ray {
    vec3 origin;     // The ray origin.
    vec3 direction;  // The ray direction.
};
// The definition of an intersection.
struct Hit {
    float t;				  // The distance between the ray origin and the intersection points along the ray. 
	vec3 intersection;        // The intersection point.
    vec3 normal;              // The surface normal at the intersection point.
	PBRMaterialData material; // The material of the object at the intersection point.
	bool light;
};
const Hit miss = Hit(1e20, vec3(0.0), vec3(0.0), PBRMaterialData(vec3(0), 0.0, vec3(0)), false);

// ----------------------------------------------------------------------------
// Local Methods
// ----------------------------------------------------------------------------
// The FresnelSchlick approximation of the reflection.
vec3 FresnelSchlick(in vec3 f0, in vec3 V, in vec3 H)
{
	float VdotH = clamp(dot(V, H), 0.0, 1.0);
	return f0 + (1.0 - f0) * pow(1.0 - VdotH, 5.0);
}

// Computes an intersection between a ray and a sphere defined by its center and radius.
// ray - the ray definition (contains ray.origin and ray.direction)
// center - the center of the sphere
// radius - the radius of the sphere
// i - the index of the sphere in the array, can be used to obtain the material from materials buffer
Hit RaySphereIntersection(Ray ray, vec3 center, float radius, int i)
{
	// Optimalized version.
	vec3 oc = ray.origin - center;
	float b = dot(ray.direction, oc);
	float c = dot(oc, oc) - (radius * radius);

	float det = b * b - c;
	if (det < 0.0) return miss;

	float t = -b - sqrt(det);
	if (t < 0.0) t = -b + sqrt(det);
	if (t < 0.0) return miss;

	vec3 intersection = ray.origin + t * ray.direction;
	vec3 normal = normalize(intersection - center);
	return Hit(t, intersection, normal, materials[i], false);
}

Hit RayLightSphereIntersection(Ray ray, vec3 center, float radius, int i)
{
	vec3 oc = ray.origin - center;
	float b = dot(ray.direction, oc);
	float c = dot(oc, oc) - (radius * radius);

	float det = b * b - c;
	if (det < 0.0) return miss;

	float t = -b - sqrt(det);
	if (t < 0.0) t = -b + sqrt(det);
	if (t < 0.0) return miss;

	vec3 intersection = ray.origin + t * ray.direction;
	vec3 normal = normalize(intersection - center);
	return Hit(t, intersection, normal, lightsMaterials[i], true);
}

// Computes an intersection between a ray and a plane defined by its normal and one point inside the plane.
// ray - the ray definition (contains ray.origin and ray.direction)
// normal - the plane normal
// point - a point laying in the plane
Hit RayPlaneIntersection(Ray ray, vec3 normal, vec3 point)
{
	float nd = dot(normal, ray.direction);
	vec3 sp = point - ray.origin;
	float t = dot(sp, normal) / nd;
	if (t < 0.0) return miss;

	vec3 intersection = ray.origin + t * ray.direction;
	// TASK 7 (Optional): Make the plane extend only to a limited distance (i.e., make it square or circle).
	// circle
	// if(length(intersection) > 30) return miss;
	// square
	if (intersection.x > 30 || intersection.x < -30 || intersection.z > 30 || intersection.z < -30)
		return miss;

	return Hit(t, intersection, normal, materials[0], false);
}

// Evaluates the intersections of the ray with the scene objects and returns the closes hit.
Hit Evaluate(Ray ray)
{
	// Sets the closes hit either to miss or to an intersection with the plane representing the ground.
	Hit closest_hit = RayPlaneIntersection(ray, vec3(0, 1, 0), vec3(0));

	// TASK 1: Iterate over all spheres, compute the intersection of the ray with each sphere and return the intersection closest to the camera.  
	//  Hints: Use function 'RaySphereIntersection' (after you implement it).
	//         See the definition of the Hit structure above.
	//         'spheres_count' contains the number of spheres
	//         'spheres[i].xyz' contains the i-th sphere position 
	//         'spheres[i].w' contains the i-th sphere radius
	for (int i = 0; i < spheres_count; i++)
	{
		vec3 center = spheres[i].xyz;
		Hit intersection = RaySphereIntersection(ray, center, spheres[i].w, i);
		if (intersection.t < closest_hit.t)
		{
			closest_hit = intersection;
		}
	}

	for (int i = 0; i < lights_spheres_count; i++)
	{
		vec3 center = spheresLights[i].xyz;
		Hit intersection = RayLightSphereIntersection(ray, center, spheresLights[i].w, i);
		if (intersection.t < closest_hit.t)
		{
			closest_hit = intersection;
		}
	}

	return closest_hit;
}

// Se usa principalmente para cálculos de sombras
Hit EvaluateWithoutSphereLights(Ray ray)// Inicialmente asumimos que no hay intersección
{
	// Inicialmente asumimos que no hay intersección
	Hit closest_hit = RayPlaneIntersection(ray, vec3(0, 1, 0), vec3(0));

	 // Iteramos sobre todas las esferas en la escena para encontrar la intersección más cercana
	for (int i = 0; i < spheres_count; i++)
	{
		vec3 center = spheres[i].xyz;
		Hit intersection = RaySphereIntersection(ray, center, spheres[i].w, i);
		// Si encontramos una intersección más cercana, la actualizamos
		if (intersection.t < closest_hit.t)
		{
			closest_hit = intersection;
		}
	}

	//Ignoramos las esferas de luz se devuelve interseccion mas cercana
	return closest_hit;
}

float Random_func(float p)  
{ //cambiar valores?
	p = fract(p * 0.1234);  
	p = p + 50.0;  
	p *= p + p;  
	return fract(p);  
} 

float AmbientOcclusion(Hit hit) {
    float occlusion = 0.0;
    float epsilon = 1e-2; // Small offset to avoid self-intersection
 
    // Number of samples for AO (keep it low for performance)
    int samples = 16;
 
    for (int i = 0; i < samples; ++i) {
        // Generate a random direction in the hemisphere
        float phi = 2.0 * 3.1415 * Random_func(i+hit.intersection.y*time);
        float theta = 0.5 * 3.1415 * Random_func(i+hit.intersection.x*time);
        vec3 sample_direction = vec3(
            sin(theta) * cos(phi),
            cos(theta),
            sin(theta) * sin(phi)
        );
 
        // Align the sample direction with the surface normal
        sample_direction = normalize(hit.normal + sample_direction);
 
        // Create a ray for the sample direction
        Ray ao_ray = Ray(hit.intersection + epsilon * hit.normal, sample_direction);
 
        // Check if the ray hits any geometry (excluding light sources)
        Hit ao_hit = EvaluateWithoutSphereLights(ao_ray);
        if (ao_hit != miss) {
            occlusion += 1.0;
        }
    }
 
    // Normalize occlusion factor
    return 1.0 - (occlusion / float(samples));
}

// Traces the ray trough the scene and accumulates the color.
vec3 Trace(Ray ray) {
    vec3 color = vec3(0.0);         // Color acumulado.
    vec3 attenuation = vec3(1.0);  // Factor de atenuación acumulado.
    const float epsilon = 1e-2;    // Desplazamiento para evitar autointersecciones.
	
    for (int i = 0; i < iterations; ++i) {
		
        // Buscar la intersección más cercana.
        Hit hit = Evaluate(ray);
		// Guardar la distancia de la primera intersección para cálculos de profundidad.
		if(i==0){
			real_distance = hit.t;
		}
		// Si no hay intersección, terminamos el trazado.
        if (hit == miss) {
            break;
        }
		

        vec3 V = -ray.direction; // Dirección hacia la cámara.
        vec3 local_color = vec3(0.0); // Color local para esta intersección.
		vec3 fresnel = FresnelSchlick(hit.material.f0, V, hit.normal);

		// Si el rayo impacta una esfera de luz, acumulamos su color y detenemos el trazado.
        if (hit.light) {
            color += hit.material.diffuse * (1.0 - fresnel) * attenuation;
            break;
        }
		// Cálculo de Oclusión Ambiental si está activado.
		float ssao = 1.0f;
		if(use_ambient_occlusion){
			ssao = AmbientOcclusion(hit);
		}

        // Iluminación local usando las luces puntuales.
        for (int j = 0; j < lights_count; j++) {
            vec3 L = normalize(lights[j].position.xyz - hit.intersection); // Dirección hacia la luz.
			vec3 T = normalize(cross(L, vec3(0, -1, 0)));//tangente
			vec3 B = normalize(cross(L, T)); // Bitangente  
			// Atenuación basada en la distancia a la luz.
			float light_distance = length(lights[j].position.xyz - hit.intersection);
			float radius = sphere_light_radius/light_distance;//lights[j].position.w / light_distance;	
           
            float attenuation_factor = 1.0 / (1.0 + 0.5 * light_distance);
			//float attenuation_factor = lights[i].atten_constant +  lights[i].atten_linear * light_distance +  lights[i].atten_quadratic * light_distance * light_distance;
						
			for (int k = 0; k < shadow_samples; k++) {  
				float rand = Random_func(iterations + i + j + k);  
				float rand_angle = 2 * 3.1415 * rand;  
				float random_r = radius * sqrt(rand);  
				vec2 point_on_disk = vec2(cos(rand_angle), sin(rand_angle)) * random_r;  
				vec3 shadow_ray_direction = L + point_on_disk.x * T + point_on_disk.y * B; 

				//Verificar sombras.
				Ray shadow_ray = Ray(hit.intersection + epsilon * L, shadow_ray_direction);
				Hit shadow_hit = EvaluateWithoutSphereLights(shadow_ray);
				if (shadow_hit == miss || shadow_hit.t >= light_distance) {
					local_color += max(dot(hit.normal, L), 0.0) * lights[j].diffuse * hit.material.diffuse * (1.0 - fresnel) * attenuation_factor * attenuation*ssao;
				}
			}

        }

        // Sumar el color local al color acumulado.
        color += local_color /shadow_samples;

        // Reflexión: calcular la dirección reflejada y continuar el rayo.
        vec3 reflection = reflect(ray.direction, hit.normal);
        ray = Ray(hit.intersection + epsilon * reflection, reflection);
		// Ajustar la atenuación acumulada con la reflectividad del material.
        attenuation *= hit.material.diffuse * fresnel; // Ajustar la atenuación acumulada.
    }

    return color;
}

// Traces the ray trough the scene and accumulates the color.
vec3 Debug(Ray ray) {
    // The accumulated color and attenuation used when tracing the rays throug the scene.
	vec3 color = vec3(0.0);
    vec3 attenuation = vec3(1.0);
	// The direction towards the light.
	vec3 L = normalize(lights[0].position.xyz);
	// Due to floating-point precision errors, when a ray intersects geometry at a surface, the point of intersection could possibly be just below the surface.
	// The subsequent reflection and shadow rays would then bounce off the *inside* wall of the surface. This is known as self-intersection.
	// We, therefore, use a small epsilon to offset the subsequent rays.
	const float epsilon = 1e-2;

	// TASK 1: At this moment we only pass the ray to Evaluate method and return the unlit color of the closest object.
	//  Hints: Nothing to implement here.
	Hit hit = Evaluate(ray);
	color = hit.material.diffuse;

    return color;
}


// ----------------------------------------------------------------------------
// Main Method
// ----------------------------------------------------------------------------
void main()
{
	// We use the texture coordinates and the aspect ratio to map the coordinates to the screen space.
	vec2 uv = (2.0 * in_data.tex_coord - 1.0);
	//vec2 uv = (2.0*gl_FragCoord.xy / resolution.xy - 1.0);// * vec2(aspect_ratio, 1.0);

	// Computes the ray origin and ray direction using the view matrix.
	vec3 P = vec3(view_inv * projection_inv * vec4(uv, -1.0, 1.0));
	vec3 direction = normalize(P - eye_position);
	Ray ray = Ray(eye_position, direction);

	// We pass the ray to the trace function.
	vec3 color = Trace(ray);
	float depth = ((1/real_distance)-(1))/((1/1000)-1);

	// TASK 8 (Optional): Add tone mapping.
	if (use_tone_mapping)
	{
		vec3 mapped = vec3(1.0) - exp2(-color * exposure);
		color = pow(mapped, vec3(1.0 / gamma));
	}
	gl_FragDepth = depth;
	final_color = vec4(color, 1.0);
}
