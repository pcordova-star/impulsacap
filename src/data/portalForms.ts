/**
 * Formularios "espejo" de los portales oficiales: las mismas secciones y preguntas, en el mismo
 * orden y con los límites de caracteres reales, para que la persona copie cada respuesta tal cual.
 *
 * Tipos de pregunta:
 *  - text:     se redacta con IA a partir del perfil y el formulador (respeta `max` caracteres)
 *  - choice:   una opción de la lista; la IA sugiere cuál marcar y por qué
 *  - multi:    varias opciones (hasta `maxPicks`); la IA sugiere
 *  - fact:     dato que solo sabe la persona (fechas, sí/no sobre la empresa): se explica, no se inventa
 *  - personal: dato personal o documento de identidad: lo pone la persona directo en el portal
 *  - doc:      archivo que hay que subir
 *  - legal:    términos o declaraciones que acepta la persona
 */
export type PortalQuestionKind = 'text' | 'choice' | 'multi' | 'fact' | 'personal' | 'doc' | 'legal';

export interface PortalQuestion {
  id: string;
  /** Número tal como aparece en el portal */
  n: string;
  /** Texto en el portal (Start-Up Chile lo muestra en inglés aunque postules en español) */
  portalLabel: string;
  /** La pregunta explicada en español simple */
  es: string;
  kind: PortalQuestionKind;
  max?: number;
  options?: string[];
  maxPicks?: number;
  hint?: string;
  optional?: boolean;
}

export interface PortalSection {
  id: string;
  title: string;
  titleEs: string;
  questions: PortalQuestion[];
}

export interface PortalForm {
  id: string;
  name: string;
  portalUrl: string;
  verifiedAt: string;
  note: string;
  /** Lo que conviene tener listo antes de empezar */
  prepare: string[];
  sections: PortalSection[];
}

const YES_NO = ['Yes', 'No'];
const INDUSTRIES = ['Agriculture & Natural Resources', 'Asset Management', 'Construction, Housing & Offices', 'Customer Service', 'Developer & IT Tools', 'Education & Learning', 'Energy & Environment', 'Financial Services', 'Health & Biotech', 'HR & Productivity', 'Legal & Data Protection', 'Lifestyle & Entertainment', 'Logistics, Transportation & Storage', 'Marketing & Media', 'Retail, Wholesales, Consumer Products', 'Social Impact', 'Travel & Tourism'];
const TECHS = ['5G & Wireless Communication', 'Advanced Manufacturing & 3D Printing', 'Advanced Materials Technology', 'Artificial Intelligence (AI) & Machine Learning (ML)', 'Robotics', 'Big Data & Analytics', 'Biotechnology & Biomedical Technology & Chemistry', 'Blockchain Technology', 'Cloud Computing', 'Cybersecurity Technology', 'Digital Payment & Fintech', 'Edge Computing', 'Internet of Things (IoT)', 'Quantum Computing', 'Satellite & Space Technology', 'Self-Driving & Autonomous Vehicles', 'Smart Home & Smart City Technologies', 'Sustainable & Energy Technologies', 'Virtual Reality (VR) & Augmented Reality (AR)', 'Wearable Technology'];
const MODELS = ['Business-to-Business (B2B)', 'Business-to-Consumer (B2C)', 'Business-to-Government (B2G)', 'Business-to-Business-to-Consumer (B2B2C)'];
const SDGS = ['Goal 1: No poverty', 'Goal 2: Zero hunger', 'Goal 3: Good health and well-being', 'Goal 4: Quality education', 'Goal 5: Gender equality', 'Goal 6: Clean water and sanitation', 'Goal 7: Affordable and clean energy', 'Goal 8: Decent work and economic growth', 'Goal 9: Industry, Innovation and Infrastructure', 'Goal 10: Reduced inequality', 'Goal 11: Sustainable cities and communities', 'Goal 12: Responsible consumption and production', 'Goal 13: Climate action', 'Goal 14: Life below water', 'Goal 15: Life on land', 'Goal 16: Peace, justice and strong institutions', 'Goal 17: Partnership for the goals', 'None of the above'];

/** Start-Up Chile BIG 13 (Build, Ignite y Growth): formulario en startupchile.charly.io, revisado el 10-11-2026 */
const SUC_BIG13: PortalForm = {
  id: 'suc_big13',
  name: 'Start-Up Chile BIG 13',
  portalUrl: 'https://startupchile.charly.io',
  verifiedAt: '2026-11-10',
  note: 'El portal muestra las preguntas en inglés aunque postules en español. Aquí van explicadas y en el mismo orden. Cada respuesta tiene el límite de caracteres del portal.',
  prepare: [
    'Cuenta en startupchile.charly.io (tu correo y contraseña)',
    'Si postulas como empresa: RUT, fecha de inicio de actividades, escritura o estatutos, certificado de vigencia y registro de accionistas (Registro de Empresas o CBR)',
    'Carnet del representante legal escaneado por ambos lados en una sola página, y su fecha de vencimiento',
    'Correo y celular personales del representante y del líder del equipo',
    'Video pitch de máximo 90 segundos en YouTube (no Shorts) o Vimeo, público y con el equipo en cámara; si tienes MVP, un segundo video de hasta 120 segundos mostrando el producto',
    'El líder del equipo debe tener al menos 10% de la empresa, dedicación exclusiva y vivir en Chile durante el programa'
  ],
  sections: [
    {
      id: 'app', title: 'Application Questions', titleEs: 'Datos de la postulación',
      questions: [
        { id: 'program', n: '1', portalLabel: 'Which program are you applying to?', es: '¿A qué programa postulas? (Build, Ignite o Growth)', kind: 'choice', options: ['Build', 'Ignite', 'Growth'] },
        { id: 'language', n: '2', portalLabel: 'In which language are you applying?', es: 'Idioma de la postulación. Elige español: las preguntas siguen en inglés, pero respondes en español.', kind: 'choice', options: ['English', 'Spanish (The questions will remain in English)'] },
        { id: 'email', n: '3', portalLabel: 'Startup email', es: 'Correo de la startup que revisas siempre: ahí llegan todas las notificaciones oficiales.', kind: 'fact' },
        { id: 'heard', n: '4', portalLabel: 'How did you hear about this application process?', es: '¿Cómo te enteraste? (hasta 3)', kind: 'fact' },
        { id: 'prev_part', n: '5', portalLabel: 'Have you ever been selected and participated in a Start-Up Chile program?', es: '¿Participaste antes en un programa de Start-Up Chile?', kind: 'fact' },
        { id: 'prev_app', n: '6', portalLabel: 'Have you applied to Start-Up Chile before?', es: '¿Postulaste antes a Start-Up Chile?', kind: 'fact' },
        { id: 'terms', n: '7', portalLabel: 'Terms and Conditions', es: 'Lee los términos y condiciones y marca que los entendiste.', kind: 'legal' },
        { id: 'startup_name', n: '8', portalLabel: 'Startup name', es: 'Nombre de la startup. Queda como nombre oficial en el contrato con Corfo y NO se puede cambiar: si postulas como empresa, usa la razón social.', kind: 'fact' },
        { id: 'applying_as', n: '9', portalLabel: "I'm applying as", es: '¿Postulas como persona natural o como empresa chilena (persona jurídica)? La empresa debe estar constituida y con inicio de actividades en el SII.', kind: 'fact' },
        { id: 'rep_data', n: '10-18', portalLabel: 'Legal Representative', es: 'Representante legal: nombres y apellidos exactos como en el carnet, género, fecha de nacimiento, RUN, carnet escaneado, vencimiento, correo y celular.', kind: 'personal' },
        { id: 'company_data', n: '19-20, 23-24', portalLabel: 'Legal Entity', es: 'RUT de la empresa, razón social, fecha de inicio de actividades en el SII y tamaño por ventas.', kind: 'fact' },
        { id: 'objeto', n: '21', portalLabel: 'Corporate Purpose (Objeto Social)', es: 'Objeto social completo, copiado tal cual de la escritura o los estatutos.', kind: 'fact' },
        { id: 'objeto_rel', n: '22', portalLabel: 'Please explain how the corporate purpose is directly associated with the primary purpose of the project and its main objectives.', es: 'Explica cómo el objeto social de la empresa calza con el proyecto y sus objetivos.', kind: 'text', max: 500 },
        { id: 'sello40', n: '25', portalLabel: 'Does the legal person have the 40 Hrs Certification?', es: '¿La empresa tiene el Sello 40 Horas del Ministerio del Trabajo?', kind: 'fact' },
        { id: 'company_docs', n: '26-28', portalLabel: 'Incorporation documents, Certificado de Vigencia, Registro de Accionistas', es: 'Sube la escritura o estatutos completos, el certificado de vigencia y el registro de accionistas (PDF).', kind: 'doc' },
        { id: 'company_address', n: '29-31', portalLabel: "Chilean Legal Person's address", es: 'Región, provincia, comuna, dirección y teléfono de la empresa.', kind: 'fact' },
        { id: 'leader_data', n: '32-40', portalLabel: 'Team Leader', es: 'Líder del equipo: nombres, género, fecha de nacimiento, correo y celular personales, país de nacimiento y residencia, ciudad y dirección. Los celulares van con formato internacional sin espacios (+56912345678).', kind: 'personal' },
        { id: 'leader_tax', n: '42-45', portalLabel: 'Valid Chilean ID / Second Category Tax Registration / Company led by a woman / Incorporated abroad', es: 'Si el líder tiene carnet chileno vigente, si tiene inicio de actividades de segunda categoría (boletas de honorarios) en el SII, si la empresa es liderada por mujeres (50% o más del capital, o 30% más la representación) y si la empresa está constituida fuera de Chile.', kind: 'fact' }
      ]
    },
    {
      id: 'project', title: 'Project Information', titleEs: 'Información del proyecto',
      questions: [
        { id: 'seven_words', n: '1', portalLabel: 'High-Level Concept Pitch (Pitch your Startup in 7 words)', es: 'Tu startup en 7 palabras, descriptivas (no un eslogan).', kind: 'text', max: 100, hint: 'Ejemplo: "Plataforma de comunicación de equipos con salas persistentes".' },
        { id: 'public_desc', n: '2', portalLabel: 'Public Description', es: 'Descripción pública: se publica si quedas seleccionado.', kind: 'text', max: 300 },
        { id: 'main_objective', n: '3', portalLabel: 'Main objective of the project', es: '¿Qué esperas lograr durante el programa?', kind: 'text', max: 500 },
        { id: 'hq', n: '4', portalLabel: 'Where are your startup headquarters?', es: '¿Dónde está la sede de la startup? (país)', kind: 'fact' },
        { id: 'other_country', n: '5', portalLabel: 'Is your startup currently operating in any other country?', es: '¿Operas hoy en otro país? Cuenta solo si tienes más de 500 usuarios, más de USD 1.000 en ventas, o empleados u oficina allá.', kind: 'fact' },
        { id: 'regions', n: '6', portalLabel: 'In which region(s) of Chile will your project have an impact?', es: '¿En qué regiones de Chile tendrá impacto? (puede ser "All regions")', kind: 'fact' },
        { id: 'online', n: '7', portalLabel: 'Does your startup currently have any of the following online presence elements?', es: 'Presencia en internet: sitio web, LinkedIn, Instagram, Facebook, Crunchbase… Al marcar cada una pide su enlace completo (con https://).', kind: 'fact' },
        { id: 'accel', n: '8', portalLabel: 'Has your startup ever participated in an accelerator/incubator program?', es: '¿Participó en una incubadora o aceleradora?', kind: 'fact' },
        { id: 'capital', n: '9-11', portalLabel: 'Raised capital / debt / formal valuation', es: '¿Levantó capital? ¿Tiene deudas (créditos, notas convertibles)? ¿Tiene una valorización hecha por terceros?', kind: 'fact' },
        { id: 'corfo_anid', n: '12-13', portalLabel: 'Funding from Corfo / ANID', es: '¿El proyecto recibió antes fondos de Corfo o de ANID? Hay que declararlos todos.', kind: 'fact' },
        { id: 'consulting', n: '14', portalLabel: "Does your startup's business model primarily rely on consulting, advisory services, or customized professional services?", es: '¿El negocio es principalmente consultoría o servicios a la medida? Si la respuesta es sí, no calificas: el modelo debe ser un producto tecnológico.', kind: 'fact' },
        { id: 'franchise', n: '15', portalLabel: 'Does your business model involve operating under a franchise license?', es: '¿Operas bajo una franquicia?', kind: 'fact' },
        { id: 'sdg', n: '16', portalLabel: 'Is your startup contributing to any of the following Sustainable Development Goals?', es: '¿A qué Objetivos de Desarrollo Sostenible de la ONU aporta?', kind: 'multi', options: SDGS, maxPicks: 4 }
      ]
    },
    {
      id: 'description', title: 'Startup Description', titleEs: 'Descripción de la startup',
      questions: [
        { id: 'video', n: '1', portalLabel: 'Online video pitch (90 seconds)', es: 'Enlace al video pitch (máx. 90 s, YouTube no Shorts o Vimeo, público, con el equipo en cámara y sin animaciones). Debe responder: problema, potencial, producto, características, por qué es innovador, quién es el equipo y por qué es el indicado.', kind: 'doc' },
        { id: 'problem', n: '2', portalLabel: 'What problem is your startup solving?', es: '¿Qué problema resuelves? ¿Es local o global? ¿Cómo se resuelve hoy? ¿A cuántos afecta?', kind: 'text', max: 500 },
        { id: 'product', n: '3', portalLabel: 'What is your product or service, and how does it solve the problem?', es: '¿Qué ofreces, qué tiene de nuevo y cómo crea valor para tus clientes?', kind: 'text', max: 500 },
        { id: 'industry', n: '4', portalLabel: 'What is the primary industry of the product or service you offer?', es: 'Industria principal de tu producto (luego eliges una subcategoría).', kind: 'choice', options: INDUSTRIES },
        { id: 'industry_why', n: '5', portalLabel: 'Please provide a justification for the selected industry and sub-industry.', es: 'Justifica la industria elegida.', kind: 'text', max: 300 },
        { id: 'customer_industry', n: '6', portalLabel: 'What is the primary industry of your target customers?', es: 'Industria principal de tus clientes.', kind: 'choice', options: INDUSTRIES },
        { id: 'tech', n: '7', portalLabel: 'What is the main technology behind your product or service?', es: 'Tecnología principal (luego eliges una subcategoría).', kind: 'choice', options: TECHS },
        { id: 'tech_explain', n: '8', portalLabel: 'Explain the science and/or technology behind the solution.', es: 'Explica la tecnología detrás de la solución, con precisión.', kind: 'text', max: 500 },
        { id: 'phase', n: '9', portalLabel: 'What phase of commercial development is your startup in?', es: 'Etapa comercial: idea, validación, prototipo, MVP sin ventas, MVP con clientes, clientes recurrentes…', kind: 'choice', options: ['Concept or idea', 'Preliminary validation and research', 'Initial prototype (pre MVP)', 'MVP', 'MVP with clients', 'Recurrent clients', 'Initial expansion phase', 'Scaling sales', 'International scale-up'] },
        { id: 'nature', n: '10', portalLabel: "Which category best describes the main nature of your startup's innovation?", es: '¿Tu innovación es de base tecnológica o científica?', kind: 'choice', options: ['Technology-Based', 'Science-Based', 'None of the above'] },
        { id: 'tech_role', n: '11', portalLabel: 'What role does technology play in your solution?', es: '¿Qué papel cumple la tecnología? (aparece si marcaste base tecnológica)', kind: 'choice', options: ['Technology is the product or service used directly by customers', 'It is the proprietary technology that enables the delivery of the service', 'Technology is embedded in a device or hardware product', 'Technology is used mainly for sales, marketing, promotion, or distribution', 'Technology is used mainly for internal operations or administration'] },
        { id: 'tech_dev', n: '12', portalLabel: 'Who develops the core technology behind your solution?', es: '¿Quién desarrolla la tecnología principal?', kind: 'choice', options: ['The technology is developed by members of the startup team.', 'The technology is developed by third parties contracted by the startup', 'The startup team adapts or integrates existing technologies into a proprietary solution.', 'The startup primarily uses third-party technologies without significant development', 'The startup commercializes or distributes technology developed by third parties.'] },
        { id: 'tech_owner', n: '13', portalLabel: 'Who owns or controls the core technology behind your solution?', es: '¿De quién es la tecnología? (la startup, los fundadores, compartida o de un tercero con licencia)', kind: 'fact' },
        { id: 'tech_diff', n: '14', portalLabel: 'What differentiates your solution from the alternatives currently available?', es: '¿Qué te diferencia de las alternativas? (algo que nadie ofrece, lo mismo pero mucho mejor por tecnología, algo que existe en otros mercados, precio o marca…)', kind: 'choice', options: ['It offers functionality that is not currently available from any solution in this market.', 'It solves the same problem as existing alternatives, but significantly better due to its technology.', 'Similar solutions exist in other markets, but they are not currently available to your target customers.', 'The main difference is based on price, brand, customer service, or distribution.', 'The solution is not substantially different from existing alternatives.'] },
        { id: 'trl', n: '15', portalLabel: 'What is the current Technology Readiness Level (TRL) of your core technology?', es: 'Nivel de madurez tecnológica (TRL 1 a 9). Con usuarios reales usando el producto es TRL 7 o más; TRL 9 si ya opera con clientes de forma estable.', kind: 'choice', options: ['TRL 1', 'TRL 2', 'TRL 3', 'TRL 4', 'TRL 5', 'TRL 6', 'TRL 7', 'TRL 8', 'TRL 9'] },
        { id: 'rnd', n: '16', portalLabel: 'Does the development of your product/service involve a Research & Development (R&D) phase?', es: '¿Tu desarrollo incluye una fase de I+D? (el desarrollo de software cuenta)', kind: 'choice', options: YES_NO },
        { id: 'rnd_start', n: '17', portalLabel: 'When did you start the R&D phase?', es: 'Fecha en que empezaste a desarrollar el producto (formato dd/mm/aaaa).', kind: 'fact' },
        { id: 'ip', n: '18', portalLabel: 'Does your venture have any intellectual property (IP)?', es: '¿Tienes propiedad intelectual? (marcas o patentes registradas, secretos industriales, acuerdos de confidencialidad)', kind: 'fact' },
        { id: 'mvp', n: '13', portalLabel: 'Do you have at least a Minimum Viable Product (MVP) or prototype?', es: '¿Tienes al menos un producto mínimo viable o prototipo?', kind: 'choice', options: YES_NO },
        { id: 'mvp_video', n: '20', portalLabel: 'MVP or Prototype Video (120 seconds)', es: 'Si tienes MVP: un SEGUNDO video, de máximo 120 segundos, mostrando el producto funcionando (enlace público de YouTube o Vimeo, mismo idioma de la postulación).', kind: 'doc' }
      ]
    },
    {
      id: 'market', title: 'Market and Business', titleEs: 'Mercado y negocio',
      questions: [
        { id: 'target_market', n: '1', portalLabel: 'What is your target market?', es: '¿Para quién es? ¿Qué características tiene? Tamaño del mercado en dólares: TAM, SAM y SOM.', kind: 'text', max: 500, hint: 'TAM: todos los clientes posibles × precio anual. SAM: la parte a la que puedes llegar. SOM: lo que puedes conseguir en 1-2 años.' },
        { id: 'competitors', n: '2', portalLabel: 'Who are your competitors or substitutes?', es: '¿Quiénes son tus competidores o alternativas y dónde están? (nunca digas que no tienes)', kind: 'text', max: 400 },
        { id: 'differentiation', n: '3', portalLabel: 'What sets you apart from your competitors?', es: '¿Qué te hace mejor o distinto?', kind: 'text', max: 400 },
        { id: 'model_primary', n: '4', portalLabel: 'What is the primary type of business model you are pursuing?', es: 'Tipo de negocio principal (a quién le vendes).', kind: 'choice', options: MODELS },
        { id: 'model_all', n: '5', portalLabel: 'Which business models (including the primary) are you currently pursuing or planning to pursue?', es: 'Todos los tipos de negocio que tienes o planeas (incluido el principal).', kind: 'multi', options: [...MODELS, 'None. We are focused only on our primary type of business model'], maxPicks: 4 },
        { id: 'revenue_model', n: '6', portalLabel: 'What is your primary revenue model?', es: '¿Cómo ganas o ganarás dinero?', kind: 'choice', options: ['Subscription', 'Transaction fees / commission', 'Product sales', 'Licensing', 'Advertising', 'Professional services / consulting', 'Revenue sharing'] },
        { id: 'commercial_start', n: '7', portalLabel: 'When did you start the commercial development of your product or service?', es: 'Fecha en que pusiste el producto a disposición de usuarios externos (incluye pilotos o pruebas gratis) o firmaste un compromiso comercial. No cuentan las pruebas internas.', kind: 'fact' },
        { id: 'traction', n: '8', portalLabel: 'Describe the traction or validation your startup has achieved.', es: 'Tracción o validación ya lograda (no proyecciones): usuarios, clientes, pilotos, cartas, ventas. En Chile y afuera.', kind: 'text', max: 600 },
        { id: 'metrics', n: '9', portalLabel: 'Provide the latest values of your key metrics (Unit Economics).', es: 'Métricas reales actuales con el año (obligatorio en Ignite y Growth): usuarios activos, ventas mensuales, costo de adquisición, conversión…', kind: 'text', max: 300 },
        { id: 'has_sales', n: '10', portalLabel: 'Does your business already have sales?', es: '¿Ya tienes ventas?', kind: 'fact' },
        { id: 'why_no_sales', n: '11', portalLabel: "Tell us why your business doesn't have sales yet", es: 'Si no tienes ventas: explica por qué todavía no (aparece al marcar que no).', kind: 'text', max: 300, optional: true },
        { id: 'scale', n: '11', portalLabel: 'How is your business model designed to scale revenue exponentially without a proportional increase in operational costs?', es: '¿Cómo crecen tus ingresos sin que los costos crezcan igual?', kind: 'text', max: 500 },
        { id: 'acquisition', n: '12', portalLabel: 'What is your strategy for capturing and retaining new customers or users?', es: '¿Cómo consigues y retienes clientes? Canales y mecanismos.', kind: 'text', max: 500 },
        { id: 'intl', n: '13', portalLabel: 'Are you planning an international expansion in the next 3 years?', es: '¿Planeas expandirte a otros países en 3 años?', kind: 'choice', options: YES_NO },
        { id: 'countries', n: '15', portalLabel: 'Which countries are you considering and what are the reasons behind your selection?', es: 'Si planeas salir de Chile: a qué países y por qué.', kind: 'text', max: 300, optional: true },
        { id: 'gtm', n: '14', portalLabel: 'What is your go-to-market strategy for the next three years?', es: 'Estrategia de entrada al mercado año a año (3 años): canales, hitos y alianzas.', kind: 'text', max: 400 },
        { id: 'uncertainties', n: '15', portalLabel: 'What are the main technical and operational uncertainties for scaling?', es: 'Principales riesgos técnicos y operativos para crecer.', kind: 'text', max: 400 },
        { id: 'barriers', n: '16', portalLabel: 'What legal, regulatory and cultural barriers limit your international expansion and how do you plan to address these barriers?', es: 'Barreras legales, regulatorias y culturales para salir de Chile, y cómo las enfrentarás.', kind: 'text', max: 400 }
      ]
    },
    {
      id: 'program', title: 'Start-Up Chile Program', titleEs: 'El programa Start-Up Chile',
      questions: [
        { id: 'chile_problem', n: '1', portalLabel: 'What problem does your technology solve in Chile?', es: '¿Qué necesidad de Chile resuelve tu tecnología y qué valor crea?', kind: 'text', max: 500 },
        { id: 'ecosystem', n: '2', portalLabel: 'How will your startup contribute to the Chilean innovation ecosystem?', es: '¿Cómo aportarás al ecosistema chileno? (empleo, talento, exportación, inversión…)', kind: 'text', max: 300 },
        { id: 'establish', n: '3', portalLabel: 'Do you plan to establish your startup in Chile?', es: '¿Tu startup está o estará establecida en Chile?', kind: 'choice', options: ["I'm already established in Chile", 'Yes', 'No', "I don't know yet"] },
        { id: 'activities', n: '4', portalLabel: 'What main activities do you plan to carry out during the Start-Up Chile program?', es: '3 a 5 actividades principales durante el programa (puedes usar viñetas).', kind: 'text', max: 500 },
        { id: 'kpis', n: '5', portalLabel: 'What are the specific, quantifiable results you expect by the end of the program? Define at least 3 KPIs', es: 'Al menos 3 resultados medibles al final del programa (ventas, contrataciones en Chile, avance tecnológico).', kind: 'text', max: 300 },
        { id: 'cofinancing', n: '6', portalLabel: 'How will you fund your required co-financing percentage?', es: '¿Cómo financiarás tu parte del cofinanciamiento?', kind: 'text', max: 300 },
        { id: 'benefits', n: '7', portalLabel: 'What benefits are you seeking from Start-Up Chile?', es: '¿Qué beneficios buscas? (hasta 3)', kind: 'multi', maxPicks: 3, options: ['Access and understanding of the Chilean/Latam market', 'Access to international partners', 'Awareness and credibility', 'Business skills development', 'Connections with potential investors', 'Corporate connections', 'Equity-free grant', 'Hiring new talent', 'Mentorship from business experts', 'Networking with like-minded entrepreneurs', 'Perks and company benefits', 'Other'] }
      ]
    },
    {
      id: 'leader', title: 'Team Leader', titleEs: 'Líder del equipo',
      questions: [
        { id: 'linkedin', n: '1', portalLabel: 'LinkedIn Profile URL (Team Leader)', es: 'Enlace al perfil público de LinkedIn del líder.', kind: 'fact' },
        { id: 'education', n: '2-4', portalLabel: 'Highest level of education completed / Institution / Area of Study', es: 'Nivel de estudios más alto TERMINADO, institución y área de estudio.', kind: 'fact' },
        { id: 'years', n: '5', portalLabel: 'How many years of professional experience does the Team Leader have?', es: 'Años de experiencia profesional (solo el número).', kind: 'fact' },
        { id: 'leader_industry', n: '6', portalLabel: 'In which industry does the Team Leader have the most experience?', es: 'Industria donde el líder tiene más experiencia.', kind: 'choice', options: INDUSTRIES },
        { id: 'leader_exp', n: '8', portalLabel: "Describe the Team Leader's experience and its relevance to this startup.", es: 'Experiencia del líder y por qué es relevante para esta startup.', kind: 'text', max: 300 },
        { id: 'leader_why', n: '9', portalLabel: 'Why is the Team Leader the right person to make the startup successful?', es: '¿Por qué el líder es la persona indicada?', kind: 'text', max: 300 },
        { id: 'leader_prev', n: '10-11', portalLabel: 'Has the Team Leader founded other startups? Tell us more (years, exit)', es: '¿Fundó otras startups antes? Si es sí: cuál, cuántos años estuvo y si tuvo una venta o salida (exit).', kind: 'fact' },
        { id: 'leader_facts', n: '12-21', portalLabel: 'C-level, position, languages, founder, ≥10% ownership, time invested, exclusive dedication, residence in Chile, prior Corfo/ANID funding', es: 'Cargo (por ejemplo CEO), idiomas, si es fundador, si tiene 10% o más de la empresa y qué porcentaje exacto (escribe solo el número, sin el signo %), cuánto tiempo le dedica hoy, dedicación exclusiva durante el programa, si vivirá en Chile y si recibió fondos de Corfo o ANID por otro proyecto.', kind: 'fact' }
      ]
    },
    {
      id: 'team', title: 'Team', titleEs: 'Equipo',
      questions: [
        { id: 'founders', n: '1-2', portalLabel: 'Number of founders / % of equity owned by the founding team', es: 'Cuántos fundadores hay (incluido el líder) y qué porcentaje de la empresa tienen (solo el número, sin %).', kind: 'fact' },
        { id: 'team_why', n: '3', portalLabel: 'Why is your founding team capable of making your startup successful?', es: 'Por qué el equipo fundador puede sacar adelante la startup: habilidades que se complementan y logros.', kind: 'text', max: 700 },
        { id: 'team_facts', n: '4-6, 8-10', portalLabel: 'Paid founders in Chile, employees, women in leadership, mentors, recommendation letter', es: 'Si pagas sueldo a fundadores o empleados en Chile, cuántos empleados tienes, cuántas mujeres lideran (números enteros, aunque sea 0), si tienes mentores y si agregarás una carta de recomendación.', kind: 'fact' },
        { id: 'key_members', n: '7', portalLabel: 'How do the key members (excluding founders) of your team strengthen your startup?', es: 'Cómo aportan los integrantes clave que no son fundadores (empleados, asesores). Opcional.', kind: 'text', max: 500, optional: true },
        { id: 'members', n: '11', portalLabel: 'Do you want to add a Team Member to the application?', es: '¿Agregas integrantes del equipo (hasta 3)? No se pueden cambiar después de enviar.', kind: 'fact' }
      ]
    },
    {
      id: 'declarations', title: 'Declarations', titleEs: 'Declaraciones',
      questions: [
        { id: 'decl', n: '1-7', portalLabel: 'Declarations I to VII', es: 'Siete declaraciones que aceptas tú: que la información es verdadera, que es tu única postulación, que te avisan por correo, que leíste los requisitos, que el líder vive en Chile, que el líder no se puede cambiar y que la información se comparte con evaluadores externos.', kind: 'legal' }
      ]
    }
  ]
};

const FORMS_BY_FUND: Record<string, PortalForm> = {
  startup_chile_build: SUC_BIG13,
  startup_chile_ignite: SUC_BIG13,
  startup_chile_growth: SUC_BIG13
};

export function portalFormFor(fundId?: string | null): PortalForm | null {
  return (fundId && FORMS_BY_FUND[fundId]) || null;
}

export interface PortalAnswer {
  text?: string;
  picks?: string[];
  reason?: string;
  /** Para datos que la persona responde directo en el portal */
  done?: boolean;
  updatedAt?: string;
}
