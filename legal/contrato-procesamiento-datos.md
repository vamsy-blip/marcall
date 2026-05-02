# Contrato de Procesamiento de Datos (DPA)

**Versión:** v1.0 · 2 de mayo de 2026

Este Contrato de Procesamiento de Datos ("DPA") forma parte de los [Términos y Condiciones](/legal/terms) entre el cliente B2B ("Cliente", actuando como **Responsable** bajo la LFPDPPP / **Controller** bajo GDPR) y MARCALL ("Procesador" / **Encargado** / **Processor**).

> **Nota importante:** Este documento es un marco contractual estándar. Para procesamiento de volúmenes elevados, datos sensibles, o casos sujetos a regímenes especiales (HIPAA, datos del sector financiero), por favor solicite una **versión negociada** escribiendo a **legal@careofaddress.com**.

## 1. Objeto y alcance

MARCALL procesa datos personales por cuenta del Cliente al operar el servicio de recepcionista virtual de IA. Los **datos personales procesados** incluyen, según la naturaleza de cada llamada:
- Número de teléfono del llamante (siempre)
- Audio de la llamada y su transcripción (durante el período de retención que el Cliente configure)
- Datos de identidad declarados por el llamante (nombre, correo, fecha de nacimiento, dirección, etc., según el caso)
- Metadatos: hora, duración, ID de agente, resultado, derivación

## 2. Roles y responsabilidades

- **Cliente (Responsable):** determina los fines y medios del procesamiento, configura los flujos del asistente, obtiene los consentimientos necesarios de los llamantes, y responde a las solicitudes ARCO/derechos del titular.
- **MARCALL (Encargado):** procesa los datos exclusivamente bajo instrucciones documentadas del Cliente (que incluyen estos términos y la configuración del panel), implementa medidas técnicas y organizativas, asiste al Cliente en sus obligaciones, y notifica incidentes.

MARCALL **no usa** los datos personales del Cliente para entrenar modelos de IA propios ni de terceros, salvo que el Cliente lo autorice expresamente por escrito.

## 3. Subencargados (sub-processors)

El Cliente autoriza a MARCALL a contratar a los subencargados listados en la sección **§7.1 del [Aviso de Privacidad](/legal/privacy)** (Vapi AI, ElevenLabs, Deepgram, Twilio, Resend, Stripe, Supabase, Sentry, etc.). MARCALL:
- Mantiene la lista actualizada y notifica con al menos **30 días de anticipación** la incorporación de un nuevo subencargado.
- Vincula contractualmente a cada subencargado con obligaciones equivalentes a las de este DPA.
- Es responsable ante el Cliente por las acciones u omisiones de sus subencargados.

El Cliente puede objetar la incorporación de un nuevo subencargado en un plazo de 14 días. Si la objeción no puede ser resuelta razonablemente, el Cliente puede terminar el servicio sin penalización.

## 4. Transferencias internacionales

Algunos subencargados están ubicados fuera de México (principalmente Estados Unidos y la Unión Europea). Las transferencias se realizan con base en:
- **México (LFPDPPP):** consentimiento del titular reflejado en el Aviso de Privacidad y/o cláusulas contractuales tipo (CCT Módulo 2).
- **UE/EEE (GDPR):** Cláusulas Contractuales Tipo de la Comisión Europea (Módulo 2 — controlador a procesador).
- **Estados Unidos:** subencargados certificados bajo el Data Privacy Framework cuando aplique.

## 5. Medidas de seguridad

MARCALL implementa, sin limitación:
- Cifrado en tránsito (TLS 1.2+) y en reposo (AES-256 para datos sensibles como secretos TOTP, tokens OAuth, números CLABE).
- Autenticación con políticas de contraseñas robustas (bcrypt, mínimo 12 caracteres) y MFA opcional para clientes.
- Aislamiento por inquilino (tenant) en la base de datos.
- Registros de auditoría con cadena de hashes (`audit_logs`) para detectar manipulación.
- Pruebas de penetración periódicas y revisiones de código de seguridad.
- Continuidad: respaldos diarios con retención de 30 días.

Las medidas detalladas se mantienen en el [Centro de Confianza](/security).

## 6. Notificación de incidentes

MARCALL notificará al Cliente sin demora indebida y a más tardar dentro de **48 horas** después de tener conocimiento confirmado de una vulneración de seguridad de los datos personales del Cliente. La notificación incluirá: naturaleza del incidente, datos y registros afectados, medidas adoptadas, y persona de contacto.

## 7. Derechos del titular (ARCO)

MARCALL asistirá al Cliente para responder a las solicitudes de los titulares (Acceso, Rectificación, Cancelación, Oposición, Portabilidad), proporcionando exportación de datos en formato estructurado y mecanismos de eliminación.

## 8. Auditoría

El Cliente puede solicitar, una vez al año y con 30 días de anticipación, evidencia razonable del cumplimiento de este DPA: certificaciones (cuando aplique), reportes de auditoría, política de seguridad. MARCALL no está obligado a permitir auditorías presenciales salvo que las exija una autoridad competente.

## 9. Devolución y eliminación de datos

A la terminación del servicio, MARCALL eliminará o devolverá (a elección del Cliente) los datos personales procesados, dentro de **30 días** posteriores a la terminación, salvo que la legislación requiera su conservación. Las copias de seguridad se purgan en el ciclo normal (máximo 90 días).

## 10. Limitación de responsabilidad

La responsabilidad bajo este DPA está sujeta a los límites de los [Términos y Condiciones](/legal/terms).

## 11. Modificaciones

MARCALL puede actualizar este DPA por motivos legales, regulatorios o de seguridad. Las versiones se publican en esta URL con fecha de vigencia. Los cambios materiales se notifican con 30 días de anticipación.

## 12. Ley aplicable y jurisdicción

Este DPA se rige por las leyes de México. Los tribunales competentes son los del Estado de Nuevo León, salvo que el Cliente esté establecido en la UE/EEE, en cuyo caso aplica también el GDPR y los tribunales del Estado miembro del Cliente para los efectos del GDPR.

---

**Para firmar una versión sellada de este DPA**, escriba a **legal@careofaddress.com** indicando la razón social del Cliente y el plan contratado.
