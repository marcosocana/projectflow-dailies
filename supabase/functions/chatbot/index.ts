import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, projectId } = await req.json();
    const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    
    if (!googleApiKey) {
      throw new Error('Google AI API key not configured');
    }

    // Get project context
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch project data
    const { data: project } = await supabase
      .from('projects')
      .select('name, project_number')
      .eq('id', projectId)
      .single();

    // Fetch recent incidents/tasks
    const { data: incidents } = await supabase
      .from('incidents')
      .select(`
        id,
        name,
        description,
        status,
        category,
        created_at,
        assigned_to,
        created_by,
        profiles:created_by(full_name),
        assigned_profiles:assigned_to(full_name)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Fetch notes
    const { data: notes } = await supabase
      .from('shared_notes')
      .select('id, title, content')
      .eq('project_id', projectId)
      .limit(10);

    // Prepare context for the AI
    const projectContext = `
Proyecto: ${project?.name || 'Proyecto'} (ID: ${project?.project_number || 'N/A'})

TAREAS/INCIDENCIAS RECIENTES:
${incidents?.map(incident => `
- ID: ${incident.id}
- Nombre: ${incident.name}
- Descripción: ${incident.description || 'Sin descripción'}
- Estado: ${incident.status}
- Categoría: ${incident.category}
- Creado por: ${incident.profiles?.full_name || 'Usuario desconocido'}
- Asignado a: ${incident.assigned_profiles?.full_name || 'Sin asignar'}
- Fecha: ${new Date(incident.created_at).toLocaleDateString()}
`).join('\n') || 'No hay tareas disponibles'}

NOTAS DEL PROYECTO:
${notes?.map(note => `
- ${note.title}: ${note.content?.substring(0, 200)}...
`).join('\n') || 'No hay notas disponibles'}
`;

    // Call Google Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Eres un asistente IA especializado en gestión de proyectos. Ayudas a los usuarios con información sobre tareas, incidencias y contenido del proyecto.

CONTEXTO DEL PROYECTO:
${projectContext}

PREGUNTA DEL USUARIO: ${message}

Responde de manera útil y específica basándote en la información del proyecto. Si no tienes información suficiente sobre algo específico, díselo al usuario. Mantén las respuestas concisas pero informativas.`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 1024,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Google AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Lo siento, no pude generar una respuesta.';

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chatbot function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Error interno del servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});