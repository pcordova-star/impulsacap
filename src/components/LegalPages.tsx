import React from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * Términos y Condiciones y Política de Privacidad de ImpulsaCap.
 * Rutas públicas: /terminos y /privacidad.
 * Si cambian proveedores, precios o funciones, actualizar este archivo y la fecha.
 */

export const LEGAL_UPDATED_AT = '20 de octubre de 2026';
const COMPANY = 'Tresna SpA';
const COMPANY_RUT = '77.023.697-5';
const COMPANY_ADDRESS = 'Av. Apoquindo 3990, oficina 605, Las Condes, Santiago, Chile';
const CONTACT = 'contacto@impulsacap.cl';

const Mail: React.FC = () => (
  <a href={`mailto:${CONTACT}`} className="text-blue-700 underline underline-offset-2 break-words">{CONTACT}</a>
);

const H2: React.FC<{ id?: string; children: React.ReactNode }> = ({ id, children }) => (
  <h2 id={id} className="scroll-mt-24 text-xl font-black text-slate-900 tracking-tight pt-6">{children}</h2>
);
const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[15px] text-slate-700 leading-relaxed">{children}</p>
);
const UL: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ul className="list-disc pl-5 space-y-2 text-[15px] text-slate-700 leading-relaxed marker:text-slate-400">{children}</ul>
);

/** Tabla de dos o tres columnas que en celular se apila como fichas. */
const InfoTable: React.FC<{ headers: string[]; rows: React.ReactNode[][] }> = ({ headers, rows }) => {
  const cols = { gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` };
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden text-sm">
      <div className="hidden sm:grid bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600" style={cols}>
        {headers.map(h => <div key={h} className="px-4 py-2.5">{h}</div>)}
      </div>
      <div className="divide-y divide-slate-200">
        {rows.map((row, i) => (
          <div key={i} className="px-4 py-3 space-y-1.5 sm:space-y-0 sm:p-0 sm:grid" style={cols}>
            {row.map((cell, j) => (
              <div key={j} className={`leading-relaxed sm:px-4 sm:py-3 ${j === 0 ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                {j > 0 && <span className="sm:hidden block text-xs text-slate-500">{headers[j]}</span>}
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const LegalLayout: React.FC<{
  title: string;
  onBack: () => void;
  onOpenOther: () => void;
  otherLabel: string;
  children: React.ReactNode;
}> = ({ title, onBack, onOpenOther, otherLabel, children }) => (
  <article className="max-w-3xl mx-auto py-6 sm:py-10 space-y-5 min-w-0">
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
    >
      <ArrowLeft className="w-4 h-4" />
      Volver
    </button>
    <header className="space-y-2 border-b border-slate-200 pb-6">
      <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{title}</h1>
      <p className="text-sm text-slate-500">Última actualización: {LEGAL_UPDATED_AT}</p>
    </header>
    {children}
    <footer className="border-t border-slate-200 pt-6 mt-10 text-sm text-slate-600 flex flex-wrap gap-x-6 gap-y-2">
      <span>¿Dudas? Escríbenos a <Mail /></span>
      <button type="button" onClick={onOpenOther} className="text-blue-700 underline underline-offset-2 cursor-pointer">
        {otherLabel}
      </button>
    </footer>
  </article>
);

interface LegalPageProps {
  onBack: () => void;
  onOpenOther: () => void;
}

/* ========================================================================== */
/* TÉRMINOS Y CONDICIONES                                                      */
/* ========================================================================== */

export const TermsPage: React.FC<LegalPageProps> = ({ onBack, onOpenOther }) => (
  <LegalLayout title="Términos y Condiciones" onBack={onBack} onOpenOther={onOpenOther} otherLabel="Ver la Política de Privacidad">
    <H2>1. Titular y aceptación</H2>
    <P>
      ImpulsaCap es una plataforma operada por <strong>{COMPANY}</strong>, RUT {COMPANY_RUT}, con domicilio en {COMPANY_ADDRESS} (en adelante, "ImpulsaCap" o "nosotros"). Contacto: <Mail />.
    </P>
    <P>
      Estos Términos y Condiciones regulan el uso del sitio impulsacap.cl y de todos sus servicios. Al crear una cuenta, marcar la casilla de aceptación o pagar un plan, declaras haberlos leído y aceptado. Si no estás de acuerdo, no uses la plataforma.
    </P>
    <P>Para usar ImpulsaCap debes ser mayor de 18 años y, si actúas por una empresa, contar con facultades para representarla.</P>

    <H2>2. Qué es y qué no es ImpulsaCap</H2>
    <P>ImpulsaCap es una herramienta de apoyo para preparar postulaciones a fondos concursables en Chile. Ofrece:</P>
    <UL>
      <li>Diagnóstico de compatibilidad con fondos y un monitor de convocatorias publicadas por organismos públicos.</li>
      <li>Una hoja de ruta por postulación, con los pasos y documentos habituales.</li>
      <li>Herramientas con inteligencia artificial para redactar borradores (formulación, cartas, expediente), simular una evaluación y resolver dudas.</li>
    </UL>
    <P>ImpulsaCap <strong>no</strong> es:</P>
    <UL>
      <li>Un organismo público ni un representante de CORFO, SERCOTEC, ANID, Start-Up Chile, FIA u otra institución. No tenemos relación con sus comités ni con sus decisiones.</li>
      <li>Una garantía de admisibilidad ni de adjudicación. El resultado de cada postulación depende exclusivamente del organismo que convoca.</li>
      <li>Un servicio de asesoría legal, tributaria o contable.</li>
    </UL>
    <P>La postulación oficial la realizas tú, en el portal del organismo correspondiente. Eres responsable de revisar las bases vigentes y de la veracidad de lo que presentes.</P>

    <H2>3. Registro y cuenta</H2>
    <UL>
      <li>Puedes registrarte con correo y contraseña o con tu cuenta de Google.</li>
      <li>Debes entregar datos verdaderos y mantenerlos actualizados, incluidos los de la empresa que representas.</li>
      <li>Tu cuenta es personal. Eres responsable de cuidar tu contraseña y de todo lo que se haga desde tu cuenta. Avísanos de inmediato si detectas un uso no autorizado.</li>
      <li>Puedes cerrar tu cuenta cuando quieras escribiendo a <Mail />. El cierre no da derecho a reembolso de un plan ya iniciado, salvo lo indicado en la sección 5.</li>
    </UL>

    <H2>4. Servicios gratuitos y Plan Trimestral</H2>
    <P>
      El diagnóstico de fondos, el catálogo, el monitor de convocatorias, el robot de ayuda, "Mis postulaciones" y la revisión de requisitos con tu carpeta tributaria son gratuitos. Las herramientas de preparación de postulaciones requieren el <strong>Plan Trimestral</strong>.
    </P>
    <InfoTable
      headers={['Concepto', 'Condición']}
      rows={[
        ['Precio', '$14.990 CLP, IVA incluido'],
        ['Códigos de vendedor', 'Un código de vendedor vigente puede dar un descuento en la primera compra, según indique el código'],
        ['Vigencia', '3 meses desde la aprobación del pago'],
        ['Renovación', 'No es automática. Si renuevas antes del vencimiento, los 3 meses se suman a la fecha de término vigente'],
        ['Medio de pago', 'Flow (flow.cl): Webpay, tarjetas de crédito y débito, y transferencia. ImpulsaCap no recibe ni almacena datos de tarjetas'],
        ['Postulaciones simultáneas', 'Hasta 3 activas. Puedes archivar una para liberar cupo'],
        ['Incluye', 'Redacción con IA, documentos y cartas, auditoría simulada, expediente de postulación y asesor experto con IA'],
        ['Uso de la IA', 'Uso razonable con un límite diario amplio que se renueva cada día a medianoche (hora de Chile), y un máximo total por plan para prevenir abusos. Si lo alcanzas, tu trabajo queda guardado y puedes seguir al día siguiente']
      ]}
    />
    <P>
      Si un pago se devuelve (por ejemplo, por retracto) o se desconoce ante el emisor de la tarjeta (contracargo), el plan activado con ese pago termina en ese momento.
    </P>
    <P>
      El plan se activa cuando Flow confirma el pago, lo que normalmente toma segundos. Los pagos pendientes se activan al acreditarse. Te enviaremos un correo con la confirmación y otro antes del vencimiento. Al vencer el plan, mantienes acceso de solo lectura a lo que ya generaste, pero no podrás generar contenido nuevo hasta renovar.
    </P>
    <P>
      Podemos cambiar los precios en el futuro. Un cambio nunca afectará un plan ya pagado y se informará en el sitio antes de aplicarse. Emitiremos la boleta o factura correspondiente a cada pago.
    </P>

    <H2 id="retracto">5. Derecho a retracto y devoluciones</H2>
    <P>
      Puedes retractarte de la compra del Plan Trimestral dentro de <strong>10 días corridos</strong> desde el pago, sin expresión de causa, <strong>siempre que no hayas comenzado a usar el servicio</strong>, conforme al artículo 3 bis de la Ley 19.496.
    </P>
    <UL>
      <li>
        <strong>Cuándo comienza el servicio:</strong> al usar por primera vez una herramienta del plan (generar una sección del formulario, un documento o carta, una auditoría o una consulta al asesor experto). Antes de ese primer uso, la plataforma te avisará en pantalla que con esa acción el servicio se entiende iniciado y que ya no podrás retractarte, y te pedirá confirmarlo.
      </li>
      <li><strong>Cómo ejercerlo:</strong> escribe a <Mail /> desde el correo de tu cuenta, indicando que ejerces tu derecho a retracto.</li>
      <li><strong>Devolución:</strong> reembolsaremos el monto pagado al mismo medio de pago, a través de Flow, dentro de 10 días hábiles desde tu solicitud. El plan se desactivará al procesar la devolución. Los plazos de abono dependen de tu banco o emisor de tarjeta.</li>
    </UL>
    <P>
      Una vez iniciado el servicio, el pago no es reembolsable, sin perjuicio de los derechos irrenunciables que te otorga la ley. Si la plataforma presenta fallas que te impiden usar el plan, contáctanos y buscaremos una solución, incluida la devolución proporcional cuando corresponda.
    </P>

    <H2>6. Uso de inteligencia artificial</H2>
    <P>Varias herramientas de ImpulsaCap generan textos y evaluaciones con modelos de inteligencia artificial de terceros (actualmente, Google Gemini).</P>
    <UL>
      <li>Los textos generados son <strong>borradores de apoyo</strong>. Pueden contener errores, omisiones o información desactualizada, y debes revisarlos y ajustarlos antes de usarlos.</li>
      <li>La auditoría simulada es una estimación orientativa. No representa ni anticipa la evaluación real de ningún comité.</li>
      <li>La calidad del resultado depende de la información que entregues. Donde falten datos, la herramienta marcará el texto como pendiente de completar en vez de inventarlo.</li>
      <li>Tú decides qué presentas y eres el único responsable del contenido final de tu postulación.</li>
    </UL>
    <P>Para generar los textos, la información que ingresas sobre tu proyecto se envía al proveedor del modelo de IA, en los términos descritos en la Política de Privacidad.</P>

    <H2>7. Información sobre fondos y convocatorias</H2>
    <P>
      El monitor de convocatorias recopila a diario información publicada en los portales oficiales de los organismos (actualmente, CORFO). Los montos, requisitos y calendarios de los fondos se muestran como referencia.
    </P>
    <P>
      Los organismos pueden modificar, suspender o cerrar una convocatoria en cualquier momento, y nuestra actualización puede tener un desfase. <strong>La fuente válida siempre es el sitio oficial y las bases de cada convocatoria</strong>, a las que enlazamos. Antes de postular, verifica fechas de cierre, requisitos y montos directamente con el organismo.
    </P>

    <H2>8. Usos prohibidos</H2>
    <P>Al usar ImpulsaCap te comprometes a no:</P>
    <UL>
      <li>Entregar información falsa o usar la plataforma para presentar antecedentes falsos ante un organismo público.</li>
      <li>Subir documentos de terceros sin autorización, ni datos personales de otras personas sin base legal para hacerlo.</li>
      <li>Compartir tu cuenta o revender el acceso al plan.</li>
      <li>Extraer datos de forma masiva o automatizada, sobrecargar el servicio o intentar eludir sus límites de uso o de seguridad.</li>
      <li>Usar la plataforma para fines ilícitos o contrarios a estos términos.</li>
    </UL>

    <H2>9. Datos personales</H2>
    <P>
      Tratamos tus datos personales y los de tu empresa (por ejemplo, la información de tu carpeta tributaria) solo para prestar el servicio, conforme a la Ley 19.628 y, desde su entrada en vigor el 1 de diciembre de 2026, a la Ley 21.719. No vendemos tus datos.
    </P>
    <P>
      El detalle de qué datos recopilamos, para qué, con qué proveedores los compartimos, cuánto tiempo los guardamos y cómo ejercer tus derechos está en la{' '}
      <button type="button" onClick={onOpenOther} className="text-blue-700 underline underline-offset-2 cursor-pointer">Política de Privacidad</button>, que forma parte de estos términos.
    </P>

    <H2>10. Propiedad intelectual</H2>
    <UL>
      <li><strong>Tu contenido es tuyo.</strong> La información de tu proyecto y los textos generados para tu postulación te pertenecen. Nos autorizas a procesarlos únicamente para prestarte el servicio.</li>
      <li><strong>La plataforma es nuestra.</strong> El software, el diseño, la marca ImpulsaCap y los contenidos propios del sitio pertenecen a {COMPANY}. No puedes copiarlos, modificarlos ni explotarlos sin autorización escrita.</li>
      <li>Los nombres y marcas de los organismos públicos se mencionan solo para identificar los fondos. Su uso no implica relación ni respaldo.</li>
    </UL>

    <H2>11. Responsabilidad</H2>
    <P>Nos esforzamos por mantener la plataforma disponible y la información correcta, pero no garantizamos que el servicio funcione sin interrupciones ni errores.</P>
    <P>ImpulsaCap no responde por:</P>
    <UL>
      <li>El resultado de una postulación, incluida su inadmisibilidad o rechazo.</li>
      <li>Decisiones tomadas en base a borradores, estimaciones o información de convocatorias sin verificar con la fuente oficial.</li>
      <li>Errores u omisiones en la información que tú entregues.</li>
      <li>Fallas de servicios de terceros (Flow, Google, portales de los organismos) o del sitio por causas ajenas a nuestro control razonable.</li>
    </UL>
    <P>Nada en estos términos limita los derechos irrenunciables que te otorga la Ley 19.496 sobre Protección de los Derechos de los Consumidores.</P>

    <H2>12. Suspensión, término y cambios</H2>
    <UL>
      <li>Podemos suspender o cerrar una cuenta que infrinja estos términos, especialmente la sección 8, informándote el motivo. Si la infracción es grave (fraude o uso ilícito), la suspensión puede ser inmediata.</li>
      <li>Podemos actualizar estos términos. Te avisaremos por correo o en la plataforma al menos 15 días antes de que un cambio relevante entre en vigencia. Los cambios no afectan las condiciones de un plan ya pagado.</li>
      <li>Si no estás de acuerdo con un cambio, puedes dejar de usar la plataforma y cerrar tu cuenta.</li>
    </UL>

    <H2>13. Ley aplicable, reclamos y contacto</H2>
    <P>Estos términos se rigen por las leyes de Chile. Para cualquier duda o reclamo, escríbenos a <Mail />; responderemos dentro de 10 días hábiles.</P>
    <P>
      Si actúas como consumidor, puedes además presentar reclamos ante el SERNAC y acudir a los tribunales competentes según la Ley 19.496. En los demás casos, las controversias se someterán a los tribunales ordinarios de Santiago.
    </P>
  </LegalLayout>
);

/* ========================================================================== */
/* POLÍTICA DE PRIVACIDAD                                                      */
/* ========================================================================== */

export const PrivacyPage: React.FC<LegalPageProps> = ({ onBack, onOpenOther }) => (
  <LegalLayout title="Política de Privacidad" onBack={onBack} onOpenOther={onOpenOther} otherLabel="Ver los Términos y Condiciones">
    <H2>1. Responsable del tratamiento</H2>
    <P>
      El responsable de tus datos personales es <strong>{COMPANY}</strong>, RUT {COMPANY_RUT}, con domicilio en {COMPANY_ADDRESS}, que opera la plataforma ImpulsaCap (impulsacap.cl).
    </P>
    <P>Para cualquier consulta sobre tus datos o para ejercer tus derechos, escríbenos a <Mail />.</P>

    <H2>2. Qué datos recopilamos</H2>
    <InfoTable
      headers={['Categoría', 'Ejemplos', 'Origen']}
      rows={[
        ['Cuenta', 'Nombre, correo, teléfono (opcional), datos de inicio de sesión con Google', 'Tú, al registrarte'],
        ['Empresa', 'Razón social, RUT, tipo de sociedad, sector, región, liderazgo femenino y el perfil de tu proyecto', 'Tú'],
        ['Carpeta tributaria', 'Inicio de actividades, ventas declaradas, periodos F29 y observaciones del SII', 'El archivo que subes; lo procesamos para extraer estos datos'],
        ['Postulaciones', 'Respuestas sobre tu proyecto, textos generados, cartas, presupuesto, resultados de auditoría', 'Tú y las herramientas de IA'],
        ['Pagos', 'Monto, fecha, estado e identificador del pago', <>Flow. <strong>No recibimos ni guardamos números de tarjeta</strong></>],
        ['Uso técnico', 'Dirección IP, navegador, registros de errores y de solicitudes, y un conteo de visitas por día y por sección del sitio, sin identificarte', 'Automático, al usar el sitio']
      ]}
    />
    <P>
      Las cartas de respaldo que generes pueden incluir nombres y cargos de terceros (por ejemplo, un cliente piloto). Al ingresarlos, declaras contar con autorización para usarlos con ese fin.
    </P>

    <H2>3. Para qué los usamos</H2>
    <InfoTable
      headers={['Finalidad', 'Base legal']}
      rows={[
        ['Crear y administrar tu cuenta', 'Ejecución del contrato (Términos y Condiciones)'],
        ['Diagnosticar fondos compatibles y preparar tus postulaciones, incluida la generación de textos con IA', 'Ejecución del contrato'],
        ['Procesar pagos, activar el plan y emitir boletas o facturas', 'Ejecución del contrato y obligaciones legales tributarias'],
        ['Enviarte correos sobre tu cuenta y tu plan (bienvenida, confirmación de compra, aviso de vencimiento) y sobre cambios a estos documentos', 'Ejecución del contrato'],
        ['Enviarte el boletín semanal de novedades de fondos y avisos cuando se abre una convocatoria que calza con los datos de tu empresa. Puedes darte de baja con el enlace al pie de cada correo', 'Interés legítimo (información relacionada con el servicio que contrataste)'],
        ['Seguridad, prevención de abusos y corrección de errores', 'Interés legítimo']
      ]}
    />
    <P>
      No usamos tus datos para publicidad de terceros ni los vendemos. No tomamos decisiones con efectos jurídicos sobre ti de forma automatizada: los resultados de diagnóstico y auditoría son orientativos y la decisión de postular es siempre tuya.
    </P>

    <H2>4. Con quién compartimos tus datos</H2>
    <P>Solo con proveedores que necesitamos para operar la plataforma, que tratan los datos por encargo nuestro:</P>
    <InfoTable
      headers={['Proveedor', 'Para qué', 'Datos']}
      rows={[
        ['Google Cloud y Firebase (Google LLC)', 'Alojamiento del sitio, base de datos y autenticación', 'Todos los datos de la plataforma'],
        ['Google Gemini (Google LLC)', 'Generar textos, leer la carpeta tributaria y responder consultas con IA', 'La información que ingresas en cada herramienta'],
        ['Flow (flow.cl)', 'Procesar los pagos del plan', 'Monto, correo e identificador del pago, y los datos que ingreses en Flow'],
        ['Resend', 'Enviar los correos de la plataforma', 'Tu correo, nombre y el contenido del aviso (por ejemplo, la fecha de vencimiento del plan)'],
        ['Cloudflare', 'Gestión del dominio (DNS) y reenvío del correo de contacto', 'Datos técnicos de conexión y los correos que nos escribas'],
        ['GitHub (Microsoft)', 'Almacenamiento del código y tareas automáticas de la plataforma', 'Información pública de convocatorias; no datos de usuarios']
      ]}
    />
    <P>También podemos entregar datos cuando una ley o una autoridad competente lo exija.</P>

    <H2>5. Transferencias internacionales</H2>
    <P>
      Nuestros servidores y los de nuestros proveedores de tecnología están fuera de Chile, principalmente en Estados Unidos (la aplicación se ejecuta en la región us-east1 de Google Cloud). Al usar ImpulsaCap, tus datos se transfieren a esos países.
    </P>
    <P>Elegimos proveedores que aplican estándares reconocidos de seguridad y protección de datos, y cuyas condiciones exigen tratar los datos solo para prestarnos el servicio.</P>

    <H2>6. Cuánto tiempo guardamos tus datos</H2>
    <InfoTable
      headers={['Datos', 'Plazo']}
      rows={[
        ['Cuenta, empresa y postulaciones', 'Mientras tu cuenta esté activa. Al cerrarla, se eliminan dentro de 30 días'],
        ['Archivo de la carpeta tributaria', 'El archivo no se guarda: se procesa en el momento y solo conservamos el nombre del archivo y un resumen de los datos extraídos'],
        ['Registros de pagos', 'El plazo que exige la ley tributaria'],
        ['Registros técnicos', 'Hasta 90 días']
      ]}
    />
    <P>Podemos conservar datos anonimizados, que ya no te identifican, con fines estadísticos.</P>

    <H2>7. Seguridad</H2>
    <UL>
      <li>Toda la comunicación con el sitio viaja cifrada (HTTPS).</li>
      <li>Cada usuario solo puede ver y modificar sus propios datos; las reglas de la base de datos lo impiden a nivel del servidor.</li>
      <li>Los pagos se procesan en Flow; nunca vemos los datos de tu tarjeta.</li>
      <li>Las claves de acceso a servicios se guardan como secretos y no en el código.</li>
    </UL>
    <P>
      Ningún sistema es completamente infalible. Si ocurre un incidente de seguridad que ponga en riesgo tus derechos, lo informaremos a la autoridad competente y a los afectados, según exige la ley.
    </P>

    <H2>8. Tus derechos</H2>
    <P>Puedes ejercer en cualquier momento, sin costo, los siguientes derechos sobre tus datos:</P>
    <UL>
      <li><strong>Acceso:</strong> saber qué datos tenemos y cómo los usamos.</li>
      <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos. La mayoría puedes editarlos tú mismo en "Mi empresa".</li>
      <li><strong>Supresión:</strong> pedir que eliminemos tus datos, salvo los que la ley nos obligue a conservar.</li>
      <li><strong>Oposición:</strong> oponerte a un tratamiento, por ejemplo, a los avisos de vencimiento por correo.</li>
      <li><strong>Portabilidad:</strong> recibir tus datos en un formato estructurado y de uso común.</li>
      <li><strong>Bloqueo:</strong> pedir que suspendamos temporalmente el tratamiento mientras se resuelve otra solicitud.</li>
      <li><strong>Retirar tu consentimiento</strong> cuando el tratamiento se base en él, sin expresar causa.</li>
    </UL>
    <P>
      <strong>Cómo ejercerlos:</strong> escribe a <Mail /> desde el correo de tu cuenta, indicando qué derecho quieres ejercer. Responderemos dentro de 30 días corridos, prorrogables por otros 30; las solicitudes de bloqueo, dentro de 2 días hábiles. Si no quedas conforme con nuestra respuesta, puedes reclamar ante la Agencia de Protección de Datos Personales.
    </P>

    <H2>9. Cookies y almacenamiento en tu navegador</H2>
    <P>
      ImpulsaCap usa solo almacenamiento técnico: mantener tu sesión iniciada (Firebase), guardar en tu navegador una copia temporal de tu avance para que la app cargue más rápido y recordar la fecha de tu última visita, para contar cuántas personas visitan el sitio cada día. Ese conteo es propio, no usa cookies, no guarda tu IP ni ningún identificador y no se comparte con terceros. No usamos cookies de publicidad ni de seguimiento de terceros.
    </P>
    <P>Si en el futuro agregamos herramientas de analítica o publicidad, actualizaremos esta política y te pediremos consentimiento cuando corresponda.</P>

    <H2>10. Menores de edad y cambios a esta política</H2>
    <P>ImpulsaCap está dirigida a personas mayores de 18 años. No recopilamos a sabiendas datos de menores; si detectamos una cuenta de un menor, la eliminaremos.</P>
    <P>Podemos actualizar esta política. Te avisaremos por correo o en la plataforma al menos 15 días antes de que un cambio relevante entre en vigencia.</P>
  </LegalLayout>
);
