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
        incident_number,
        name,
        description,
        status,
        category,
        created_at,
        assigned_to,
        created_by,
        environment,
        device,
        epic,
        profiles:created_by(full_name),
        assigned_profiles:assigned_to(full_name)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Fetch tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        status,
        is_completed,
        created_at,
        assigned_to,
        person_id,
        daily_id,
        incident_id,
        assigned_profile:assigned_to(full_name),
        person:person_id(name, role)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(25);

    console.log('Tasks fetched:', JSON.stringify(tasks, null, 2));

    // Fetch notes
    const { data: notes } = await supabase
      .from('shared_notes')
      .select('id, title, content')
      .eq('project_id', projectId)
      .limit(10);

    // Fetch contacts
    const { data: contacts } = await supabase
      .from('contacts')
      .select('name, email, phone, role, description')
      .eq('project_id', projectId)
      .limit(10);

    // Fetch team members
    const { data: people } = await supabase
      .from('people')
      .select('name, role')
      .eq('project_id', projectId)
      .limit(15);

    // Fetch releases
    const { data: releases } = await supabase
      .from('releases')
      .select('platform, version, description, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch interesting links
    const { data: links } = await supabase
      .from('interesting_links')
      .select('name, url, description')
      .eq('project_id', projectId)
      .limit(10);

    // Fetch repository files
    const { data: files } = await supabase
      .from('repository_files')
      .select('name, description, content_type, file_size')
      .eq('project_id', projectId)
      .limit(10);

    // Fetch recent vacations
    const { data: vacations } = await supabase
      .from('vacations')
      .select(`
        start_date,
        end_date,
        description,
        type,
        profiles:user_id(full_name)
      `)
      .eq('project_id', projectId)
      .gte('end_date', new Date().toISOString().split('T')[0])
      .order('start_date', { ascending: true })
      .limit(10);

    // Prepare context for the AI
    const projectContext = `
Proyecto: ${project?.name || 'Proyecto'} (ID: ${project?.project_number || 'N/A'})

INCIDENCIAS/TAREAS PRINCIPALES:
${incidents?.map(incident => `
- #${incident.incident_number}: ${incident.name}
- Descripción: ${incident.description || 'Sin descripción'}
- Estado: ${incident.status} | Categoría: ${incident.category}
- Creado por: ${incident.profiles?.full_name || 'Usuario desconocido'}
- Asignado a: ${incident.assigned_profiles?.full_name || 'Sin asignar'}
- Entorno: ${incident.environment || 'N/A'} | Dispositivo: ${incident.device || 'N/A'}
- Epic: ${incident.epic || 'N/A'}
- Fecha: ${new Date(incident.created_at).toLocaleDateString()}
`).join('\n') || 'No hay incidencias disponibles'}

TAREAS ADICIONALES:
${tasks?.length > 0 ? tasks.map(task => {
  const assignedPerson = task.assigned_profile?.full_name || task.person?.name || 'Sin asignar';
  const taskType = task.incident_id ? 'Relacionada con incidencia' : 
                   task.daily_id ? 'Tarea diaria' : 'Tarea independiente';
  const completionStatus = task.is_completed ? '✅ COMPLETADA' : '⏳ PENDIENTE';
  
  return `
- 📋 ${task.title}
- Descripción: ${task.description || 'Sin descripción'}
- Estado: ${task.status} | ${completionStatus}
- Tipo: ${taskType}
- Asignado a: ${assignedPerson}${task.person?.role ? ` (${task.person.role})` : ''}
- Fecha: ${new Date(task.created_at).toLocaleDateString()}`;
}).join('\n') : 'No hay tareas adicionales registradas'}

NOTAS DEL PROYECTO:
${notes?.map(note => `
- ${note.title}: ${note.content?.substring(0, 200)}${note.content?.length > 200 ? '...' : ''}
`).join('\n') || 'No hay notas disponibles'}

CONTACTOS:
${contacts?.map(contact => `
- ${contact.name} (${contact.role || 'Sin rol'})
- Email: ${contact.email || 'N/A'} | Teléfono: ${contact.phone || 'N/A'}
- Descripción: ${contact.description || 'Sin descripción'}
`).join('\n') || 'No hay contactos disponibles'}

EQUIPO DEL PROYECTO:
${people?.map(person => `
- ${person.name} - ${person.role}
`).join('\n') || 'No hay miembros del equipo definidos'}

RELEASES/VERSIONES:
${releases?.map(release => `
- ${release.platform} v${release.version}
- Descripción: ${release.description || 'Sin descripción'}
- Fecha: ${new Date(release.created_at).toLocaleDateString()}
`).join('\n') || 'No hay releases disponibles'}

ENLACES DE INTERÉS:
${links?.map(link => `
- ${link.name}: ${link.url}
- Descripción: ${link.description || 'Sin descripción'}
`).join('\n') || 'No hay enlaces disponibles'}

ARCHIVOS DEL REPOSITORIO:
${files?.map(file => `
- ${file.name} (${file.content_type || 'Unknown'}, ${Math.round((file.file_size || 0) / 1024)}KB)
- Descripción: ${file.description || 'Sin descripción'}
`).join('\n') || 'No hay archivos disponibles'}

VACACIONES PRÓXIMAS:
${vacations?.map(vacation => `
- ${vacation.profiles?.full_name || 'Usuario'}: ${vacation.start_date} a ${vacation.end_date}
- Tipo: ${vacation.type} | Descripción: ${vacation.description || 'Sin descripción'}
`).join('\n') || 'No hay vacaciones próximas'}
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
            text: `Eres un asistente IA especializado en gestión de proyectos. Ayudas a los usuarios con información completa sobre el proyecto actual.

CONTEXTO DEL PROYECTO:
${projectContext}

PREGUNTA DEL USUARIO: ${message}

Responde de manera útil y específica basándote en toda la información del proyecto disponible. Puedes proporcionar información sobre:
- **Incidencias y tareas**: estado, asignaciones, fechas, detalles técnicos, tipo (incidencia/mejora)
- **Tasks/Tareas**: pueden ser incidencias, mejoras o tareas diarias. Indica si están completadas o pendientes
- Notas y documentación del proyecto
- Contactos y equipo del proyecto  
- Releases y versiones
- Enlaces de interés y recursos
- Archivos del repositorio
- Vacaciones y disponibilidad del equipo

IMPORTANTE: Las "tasks" son elementos de trabajo que pueden ser de diferentes tipos:
- 🐛 Incidencias (bugs, problemas)
- ✨ Mejoras evolutivas (nuevas funcionalidades)
- 📋 Tareas diarias o generales

Cuando muestres información sobre tasks, especifica claramente su estado (completada/pendiente) y tipo.

Si no tienes información suficiente sobre algo específico, díselo al usuario. Mantén las respuestas concisas pero informativas. Si es relevante, puedes mencionar números de incidencias (#123) o fechas específicas.`
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