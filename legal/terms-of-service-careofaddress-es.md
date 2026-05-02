[//]: # (ARCHIVO: terms-of-service-careofaddress-es.md — BORRADOR v0.2 para dominio careofaddress.com. PENDIENTE DE REVISIÓN POR ABOGADO MEXICANO ESPECIALISTA EN DERECHO TECNOLÓGICO Y CONTRATOS SaaS ANTES DE PUBLICAR EN PRODUCCIÓN. Este documento no constituye asesoría legal.)

# Términos de Servicio — MARCALL

**Fecha de última actualización:** 2 de mayo de 2026  
**Versión:** 0.2  
**Dominio:** marcall.careofaddress.com  
**Sustituye a:** terminos-y-condiciones.md (v1.0, archivado en `/legal/_archive/`)

---

## 1. Aceptación de los Términos

Al crear una cuenta, iniciar un Período de Prueba, contratar cualquier Plan de pago, o usar los servicios de **MARCALL** en cualquiera de sus formas, el **Cliente** acepta quedar vinculado por los presentes Términos de Servicio (los **"Términos"**), el Aviso de Privacidad vigente en `https://marcall.careofaddress.com/aviso-de-privacidad`, la Política de Uso Aceptable (**"PUA"**) y cualquier política operativa publicada en `https://marcall.careofaddress.com`.

**Aceptación electrónica:** De conformidad con el artículo 1803 del Código Civil Federal (**CCF**), la aceptación de los presentes Términos mediante formulario electrónico (casilla de verificación, clic en "Aceptar" o flujo de registro equivalente) constituye un consentimiento válido con plenos efectos legales. MARCALL conserva evidencia del consentimiento (fecha y hora, versión de Términos aceptada, identificador de sesión) conforme al artículo 8 de la LFPDPPP. Si actúa en nombre de una persona moral, declara contar con las facultades suficientes para obligarla.

---

## 2. Definiciones

| Término | Definición |
|---------|-----------|
| **MARCALL** | La plataforma SaaS de asistente de voz con inteligencia artificial operada por **[Razón Social del Responsable]**, con RFC `[RFC de MARCALL]`, con domicilio en San Pedro Garza García, Nuevo León, México |
| **Plataforma** | El software, aplicación web, APIs, infraestructura y servicios operados en `https://marcall.careofaddress.com` |
| **Cliente** | La persona física con actividad empresarial o persona moral que contrata el servicio y es responsable de la cuenta y el pago |
| **Usuario** | Cualquier persona autorizada por el Cliente para acceder al panel de administración |
| **Tenant** | La instancia individual del servicio asignada a cada Cliente; accesible en `https://<slug>.marcall.careofaddress.com` |
| **Sub-Tenant** | Tenant creado por un Revendedor en favor de sus clientes finales |
| **Asistente** | El agente de voz con IA configurado por el Cliente dentro de su Tenant |
| **Llamada** | Cada sesión de comunicación de voz gestionada por un Asistente |
| **Minutos** | Unidad de medición del tiempo de uso de voz, calculada por minuto completo o fracción |
| **Plan** | La modalidad de suscripción mensual contratada conforme a la sección 4 |
| **Período de Prueba** | El período gratuito descrito en la sección 5 |
| **Revendedor** | Cliente habilitado para crear Sub-Tenants bajo el Programa de Revendedores |
| **DPA** | Acuerdo de Tratamiento de Datos, disponible en `https://marcall.careofaddress.com/legal/dpa` |
| **PUA** | Política de Uso Aceptable, disponible en `https://marcall.careofaddress.com/legal/acceptable-use` |
| **Tiempo de Inactividad** | Período en que la Plataforma no está disponible para el Cliente, excluidas las ventanas de mantenimiento programado notificadas con al menos 48 horas de anticipación |
| **Datos del Cliente** | Todos los datos (incluidos datos personales de terceros) que el Cliente cargue, genere o transmita a través de la Plataforma |

---

## 3. Cuenta y Registro

3.1 Para acceder al servicio, el Cliente deberá crear una cuenta con información veraz, actualizada y completa, incluyendo nombre, correo electrónico corporativo, RFC y datos de facturación.

3.2 El Cliente es responsable de mantener la confidencialidad de sus credenciales y de todas las actividades bajo su cuenta. Ante sospecha de acceso no autorizado, deberá notificar a MARCALL de inmediato a **support@careofaddress.com**.

3.3 MARCALL podrá rechazar o cancelar registros que incumplan estos Términos, proporcionen información falsa o representen un riesgo para la Plataforma o terceros.

3.4 Cada Plan permite un número determinado de Asistentes y Usuarios según la tabla de planes en `https://marcall.careofaddress.com/precios`.

---

## 4. Planes, Facturación y Pagos

### 4.1 Planes disponibles

| Plan | Precio mensual (MXN + IVA) | Descripción |
|------|---------------------------|-------------|
| **Inicia** | $799 + IVA | Para negocios que inician con asistente de voz |
| **Crece** | $2,499 + IVA | Para negocios en expansión |
| **Empresa** | $4,999 + IVA | Para empresas con SLA reforzado |
| **Agencia** | $9,999 + IVA | Para revendedores multi-cliente |

Los detalles de cada Plan forman parte de estos Términos y se publican en `https://marcall.careofaddress.com/precios`.

### 4.2 Minutos y excedente

Cada Plan incluye un volumen mensual de Minutos. Los Minutos adicionales se cobrarán a la tarifa vigente publicada en `https://marcall.careofaddress.com/precios`. MARCALL notificará al Cliente al alcanzar el 80% y 100% de los Minutos incluidos.

### 4.3 Renovación automática

Los Planes se renuevan automáticamente cada mes en la misma fecha de contratación, salvo cancelación expresa conforme a la sección 14.

### 4.4 Impuestos

Los precios no incluyen IVA ni otros impuestos aplicables. El IVA se añade a la factura conforme a la legislación fiscal mexicana. El Cliente es responsable de proporcionar sus datos fiscales correctos para la emisión de CFDI.

### 4.5 Procesador de pagos

Los pagos se procesan a través de **Stripe Inc.** (PCI-DSS). Al proporcionar datos de pago, el Cliente acepta los Términos de Stripe en stripe.com/mx/legal. MARCALL no almacena datos de tarjeta directamente.

### 4.6 Política de reembolsos y devoluciones

**Garantía de 14 días en el primer mes:** El Cliente que contrate por primera vez un Plan de pago de MARCALL podrá solicitar la cancelación y reembolso total dentro de los **14 días naturales** siguientes al primer cargo, enviando la solicitud a **support@careofaddress.com**. Esta garantía aplica únicamente al primer mes del primer Plan contratado; no aplica a renovaciones ni cambios de Plan.

Fuera de esta ventana, los cargos mensuales no son reembolsables, salvo en los siguientes casos excepcionales:
- Error técnico atribuible exclusivamente a MARCALL que haya impidido el uso del servicio durante más del 20% del período facturado, verificado mediante registros internos.
- Cobro duplicado o incorrecto demostrable.

Las solicitudes de reembolso excepcional deben dirigirse a **support@careofaddress.com** dentro de los 10 días hábiles siguientes al cargo.

---

## 5. Período de Prueba

5.1 MARCALL ofrece un Período de Prueba de **7 días calendario** desde la creación de la cuenta, sin tarjeta de crédito, con número de demostración provisto por MARCALL.

5.2 Al término del Período de Prueba, el acceso queda suspendido. Para continuar, el Cliente deberá contratar un Plan.

5.3 Las configuraciones del Período de Prueba se conservan por 15 días adicionales para recuperación al contratar un Plan.

---

## 6. Uso del servicio — Política de Uso Aceptable

6.1 El uso de la Plataforma está sujeto a la **Política de Uso Aceptable (PUA)**, disponible en `https://marcall.careofaddress.com/legal/acceptable-use`, la cual se incorpora por referencia en estos Términos.

6.2 El Cliente es responsable de que todos sus Usuarios y Sub-Tenants cumplan con la PUA.

6.3 El incumplimiento de la PUA puede resultar en la suspensión o terminación del servicio conforme a la sección 14.

---

## 7. Tratamiento de datos — DPA

7.1 El tratamiento de datos personales de los clientes del Cliente a través de la Plataforma se rige por el **Acuerdo de Tratamiento de Datos (DPA)** de MARCALL, disponible en `https://marcall.careofaddress.com/legal/dpa`, que se incorpora por referencia en estos Términos.

7.2 Para clientes del sector salud que requieran un Business Associate Agreement (BAA), aplica el documento BAA disponible en el Trust Center de MARCALL. El BAA requiere la contratación del plan Empresa Salud.

7.3 Para Clientes que transfieran datos de residentes de la UE o del RU, aplica el Addendum de CCT / IDTA disponible en el Trust Center.

---

## 8. Niveles de servicio (SLA) y créditos

### 8.1 Objetivo de disponibilidad

MARCALL se compromete a un objetivo de disponibilidad de la Plataforma del **99.5%** mensual, medido como porcentaje del tiempo total del mes excluyendo el Tiempo de Inactividad programado.

### 8.2 Tabla de créditos por incumplimiento

Si la disponibilidad mensual cae por debajo del objetivo, el Cliente recibirá un crédito en su siguiente factura:

| Disponibilidad mensual | Crédito sobre la cuota mensual |
|----------------------|-------------------------------|
| 99.0% – 99.4% | 10% |
| 95.0% – 98.9% | 25% |
| < 95.0% | 50% |

Los créditos son el único remedio del Cliente por incumplimientos de disponibilidad, salvo lo dispuesto en la Limitación de Responsabilidad.

### 8.3 Ventana de reclamación

Las solicitudes de crédito deben presentarse dentro de los **30 días naturales** siguientes al incidente de Tiempo de Inactividad, enviando un correo a **support@careofaddress.com** con el asunto "Solicitud de crédito SLA — [fecha del incidente]". Las solicitudes fuera de plazo no serán procesadas.

---

## 9. Propiedad intelectual

9.1 **Plataforma:** MARCALL y sus licenciantes son y seguirán siendo los propietarios exclusivos de todos los derechos sobre la Plataforma, incluyendo marcas, patentes, derechos de autor y secretos comerciales. Nada en estos Términos transfiere derechos de propiedad al Cliente.

9.2 **Datos del Cliente:** El Cliente conserva todos los derechos sobre sus Datos del Cliente. MARCALL no adquiere derechos de propiedad sobre los Datos del Cliente más allá de los necesarios para prestar el servicio conforme al DPA.

9.3 **Retroalimentación:** El Cliente podrá proporcionar comentarios o sugerencias sobre la Plataforma. MARCALL puede usar dichos comentarios libremente para mejorar su servicio sin obligación de compensación al Cliente.

---

## 10. Confidencialidad

Cada parte se compromete a mantener en estricta confidencialidad la información no pública de la otra parte recibida en el contexto del servicio, y a usarla únicamente para los fines previstos en estos Términos. Esta obligación no aplica a información que: (a) sea o se vuelva pública sin incumplimiento de esta obligación; (b) ya fuera conocida por la parte receptora sin restricción de confidencialidad; (c) sea desarrollada de forma independiente; o (d) deba divulgarse por mandato legal o judicial.

---

## 11. Limitación de responsabilidad

### 11.1 Exclusión de daños indirectos

**En la máxima medida permitida por la ley aplicable**, ninguna de las partes será responsable ante la otra por daños indirectos, incidentales, especiales, consecuentes, punitivos o por pérdida de beneficios, pérdida de ingresos, pérdida de datos o pérdida de oportunidades de negocio, aunque hubiera sido advertida de la posibilidad de dichos daños.

### 11.2 Tope de responsabilidad agregada

La responsabilidad total agregada de cada parte frente a la otra, por cualquier reclamación bajo o relacionada con estos Términos (ya sea por contrato, agravio, responsabilidad objetiva o de otro tipo) no excederá la suma de los **cargos pagados o exigibles por el Cliente en los 12 meses inmediatamente anteriores** al evento que originó la reclamación.

### 11.3 Excepciones al tope

El tope anterior no aplica a:
- (a) Muerte o lesiones personales causadas por negligencia comprobada;
- (b) Fraude o dolo;
- (c) Indemnizaciones por infracción de propiedad intelectual conforme a la sección 9;
- (d) Violaciones de confidencialidad que causen daño real y demostrable;
- (e) Obligaciones de pago de cualquiera de las partes.

---

## 12. Indemnización

El Cliente indemnizará, defenderá y mantendrá indemne a MARCALL, sus funcionarios, empleados y subcontratistas frente a cualquier reclamación, demanda, responsabilidad, daño, pérdida y costo (incluyendo honorarios razonables de abogados) que surja de o esté relacionado con:
(a) El incumplimiento por parte del Cliente de estos Términos o de la PUA;
(b) La violación de derechos de terceros (incluyendo derechos de privacidad) por el uso del servicio por parte del Cliente;
(c) Los contenidos o instrucciones configurados por el Cliente en sus Asistentes;
(d) Las llamadas realizadas o recibidas a través de la Plataforma por el Cliente o sus usuarios finales.

---

## 13. Declaraciones y garantías

### 13.1 Anticorrupción

El Cliente declara y garantiza que:
(a) No ofrecerá, pagará, prometará, autorizará ni recibirá ningún pago, regalo u otro beneficio de valor a ningún funcionario, empleado o agente gubernamental o de empresa privada con el propósito de influir indebidamente en una acción o decisión en relación con los servicios de MARCALL;
(b) Cumplirá con la **Ley Federal Anticorrupción en Contrataciones Públicas (LFACP)** y la **Ley General del Sistema Nacional Anticorrupción** de México, así como con la **U.S. Foreign Corrupt Practices Act (FCPA)** y la **UK Bribery Act** en la medida en que sean aplicables a sus operaciones.

### 13.2 Sanciones

El Cliente declara y garantiza que:
(a) No es una persona o entidad que figure en las listas de sanciones de la **Oficina de Control de Activos Extranjeros (OFAC)** del Departamento del Tesoro de EE.UU., del Consejo de la UE, del Comité de Sanciones del Consejo de Seguridad de la ONU, ni en ninguna otra lista de restricciones comerciales aplicable;
(b) No utilizará los servicios de MARCALL en violación de leyes o reglamentos de sanciones aplicables;
(c) No permitirá que sus Sub-Tenants o usuarios finales usen el servicio en territorios embargados o sancionados.

---

## 14. Vigencia y terminación

### 14.1 Vigencia

Estos Términos entran en vigor en la fecha de aceptación por el Cliente y permanecen vigentes mientras el Cliente mantenga una cuenta activa con MARCALL, incluyendo durante cualquier Período de Prueba y Plan de pago.

### 14.2 Terminación por el Cliente

El Cliente puede cancelar su Plan en cualquier momento desde el panel de administración en `https://marcall.careofaddress.com/app/settings/subscription` o enviando aviso por escrito a **support@careofaddress.com** con al menos **30 días naturales de anticipación** al siguiente período de facturación. La cancelación surte efectos al término del período de facturación en curso.

### 14.3 Terminación por MARCALL — por causa

MARCALL puede terminar el servicio con efecto inmediato, previa notificación al Cliente, si:
(a) El Cliente incumple materialmente estos Términos o la PUA y no subsana el incumplimiento dentro de **15 días** siguientes a la notificación escrita de MARCALL;
(b) El Cliente comete un incumplimiento no subsanable (incluyendo fraude, violación de sanciones, o uso para actividades ilegales);
(c) El Cliente no paga las cuotas correspondientes y no subsana el impago dentro de los **10 días** siguientes a la notificación.

### 14.4 Terminación por MARCALL — por conveniencia

MARCALL puede terminar estos Términos por conveniencia con **30 días de aviso previo** al Cliente.

### 14.5 Efectos de la terminación

Tras la terminación:
- El acceso del Cliente a la Plataforma quedará desactivado al término del período aplicable.
- El Cliente tendrá una **ventana de exportación de datos de 30 días** para descargar sus Datos del Cliente en formato JSON/MP3 desde el panel de administración.
- Transcurridos los 30 días posteriores a la terminación sin que el Cliente exporte sus datos, MARCALL procederá a su **eliminación definitiva** (con borrado criptográfico de respaldos dentro de los 60 días siguientes).
- Las cláusulas de estas Términos que por su naturaleza deban sobrevivir a la terminación continuarán en vigor, incluyendo confidencialidad, propiedad intelectual, limitación de responsabilidad, indemnización, y las disposiciones sobre ley aplicable.

---

## 15. Fuerza mayor

Ninguna de las partes incurrirá en responsabilidad frente a la otra por el incumplimiento o retraso en el cumplimiento de sus obligaciones bajo estos Términos en la medida en que dicho incumplimiento o retraso sea causado por circunstancias ajenas al control razonable de la parte afectada, incluyendo desastres naturales, guerras, actos terroristas, disturbios civiles, pandemias, actos de gobierno, fallos de infraestructura de internet, o interrupciones de servicios de proveedores externos fuera del control de MARCALL. La parte afectada deberá notificar a la otra sin demora y adoptar esfuerzos razonables para mitigar los efectos del evento de fuerza mayor.

---

## 16. Ley aplicable y jurisdicción

16.1 Los presentes Términos se rigen e interpretan de conformidad con las leyes de los **Estados Unidos Mexicanos**, con aplicación preferente de la legislación federal y, en su caso, de la del Estado de **Nuevo León** (sede de MARCALL).

16.2 Las partes se someten a la jurisdicción de los **tribunales federales y locales competentes en la Ciudad de México** (jurisdicción alternativa si Nuevo León no aplica para el tipo de acción) o en **San Pedro Garza García, Nuevo León**, para resolver cualquier controversia derivada de o relacionada con estos Términos.

16.3 Las partes acuerdan intentar resolver cualquier controversia primero mediante negociación directa de buena fe durante al menos **30 días** antes de iniciar cualquier procedimiento judicial o arbitral.

---

## 17. Disposiciones generales

### 17.1 Divisibilidad

Si alguna disposición de estos Términos se declarara inválida, ilegal o inaplicable, las demás disposiciones permanecerán en pleno vigor.

### 17.2 Renuncia

La falta de ejercicio o el retraso en el ejercicio de cualquier derecho bajo estos Términos no implicará renuncia a dicho derecho.

### 17.3 Cesión

El Cliente no puede ceder ni transferir sus derechos u obligaciones bajo estos Términos sin el consentimiento previo por escrito de MARCALL. MARCALL puede ceder estos Términos a una entidad sucesora en caso de fusión, adquisición o venta de la totalidad o de una parte sustancial de sus activos.

### 17.4 Contrato completo

Estos Términos, junto con el DPA, la PUA, el Aviso de Privacidad y la tabla de Planes vigente, constituyen el acuerdo completo entre las partes respecto del objeto de estos Términos y sustituyen cualquier acuerdo, propuesta o representación previa.

### 17.5 Notificaciones

Las notificaciones legales a MARCALL deben dirigirse a **legal@careofaddress.com** o al domicilio legal de MARCALL en San Pedro Garza García, N.L. Las notificaciones al Cliente se enviarán al correo electrónico registrado en la cuenta.

### 17.6 Relación entre las partes

Nada en estos Términos crea una relación de sociedad, empresa conjunta, mandato, agencia o empleo entre MARCALL y el Cliente.

---

*MARCALL — terms-of-service-careofaddress-es.md — Versión 0.2 — 2 de mayo de 2026*  
*Pendiente de revisión por abogado antes de publicación formal.*  
*Contacto legal: legal@careofaddress.com | marcall.careofaddress.com*
