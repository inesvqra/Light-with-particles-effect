University assigment

Given a framework, the objective is to create a scene with a snowman, and a 3 lights dropping particle
effects.

The original scene consist on a snowman composed of 10 spheres, 3 point lights that rotate arround the 
snowman, while changing color dynamically, and the main camera. The rendering employs the standard 
OpenGL rasterization pipeline, utilizing both forward-lit and unlit shaders.
The lights are stored in the phong_lights_ubo uniform buffer object. 

The objective of the task where the following:

- Requirement to implement a raytracing algorithm that will render the snowman, rotating lights and a floor.
o All three lights must illuminate the scene with their respective colors. 
o The snowman and lights must be reflected on the floor and on the snowman itself.  
o The quality of the reflections must be adjustable from GUI. 
o The floor is not in the initial project and must be added by you. 
• The snowman must cast soft shadows on the floor. 
o The softness of the shadows must correspond to the size of the lights, which must be 
adjustable from the GUI. The smaller the light, the harder the shadow (i.e., 0 
corresponds to hard shadows, and 1 corresponds to very soft shadows).  
o The quality of the soft shadows must be adjustable from GUI (unless you use advanced 
analytical approaches which estimate the penumbra correctly).  
o The size of the light must be reflected by its sphere representation within the scene.  
• The light must be followed by a “comet-like” tail of particles (see Figures). 
o The thickness of the tail must correspond to the size of the light. 
o The color of particles must correspond to the color of the light at the time when the 
particle was generated (i.e., it must not change as the light changes its color). 
o The particles must be influenced by gravity and disappear when they touch the floor. 
o The application must enable the adjusting of the numbers of particles from GUI, it must 
also be possible to disable the entire effect.  
o The stream of the particles should be continuous, but individual particles must be 
recognizable (at least when the small number of particles is used). 
o The particles must correctly handle the depth, meaning that if a particle falls behind the 
snowman, it should not be visible. 
o The particles cannot be just points, but they must have a complex shape. 
o The particles can (but does not have to) be rendered using rasterization to avoid VERY 
computationally expensive evaluation of all the intersections with rays. 
• Everything must work when the scene is rotated, or the window size is changed. 
• The computation time must be reasonable, i.e., the rendering should not drop below 5 FPS for a 
window with a resolution of 1280x720 pixels and reasonable settings of shadow quality (e.g., 16 
samples). For very high shadow quality, the computational time may (most definitely will) drop 
way below the 30 FPS threshold which is acceptable
