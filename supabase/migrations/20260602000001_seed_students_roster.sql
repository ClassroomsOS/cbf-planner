-- 20260602000001_seed_students_roster.sql
-- Seed del roster completo CBF 2026 — Grados 7.°–11.° (Blue y Red)
-- ~216 estudiantes. ON CONFLICT DO NOTHING — idempotente.
-- NOTA: SARMIENTO ROJANO MATEO (9.° Red) tiene email=NULL por conflicto con
--       SANCHEZ ROJAS JUAN SEBASTIAN (ambos tenían juansanchez@redboston.edu.co).
--       El docente debe asignar el correo correcto vía la vista de correos en /students.

DO $$
DECLARE
  v_school uuid := 'a21e681b-5898-4647-8ad9-bdb5f9844094';
  v_tid    uuid;
BEGIN
  SELECT id INTO v_tid FROM teachers
  WHERE email = 'edoardoortiz@redboston.edu.co' LIMIT 1;

  INSERT INTO school_students
    (school_id, teacher_id, name,
     first_name, second_name, first_lastname, second_lastname,
     email, representative_email, grade, section)
  VALUES

  -- ════════════════════════════════════════
  -- 7.° BLUE
  -- ════════════════════════════════════════
  (v_school, v_tid, 'CARLOS DAVID ACEVEDO DUQUE',
   'CARLOS','DAVID','ACEVEDO','DUQUE',
   'cacevedo@redboston.edu.co','carlosalbertoacevedomonsalve@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'ANDREA KAROLINA AGUIRRE CONTRERAS',
   'ANDREA','KAROLINA','AGUIRRE','CONTRERAS',
   'andreaaguirre@redboston.edu.co','nancycontreras@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'MILTON SANTIAGO BARRAGAN RENDON',
   'MILTON','SANTIAGO','BARRAGAN','RENDON',
   'mbarragan@redboston.edu.co','miltonjavierbarragannieto@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'FLAVIA SOFIA CAMPO REVOLLO',
   'FLAVIA','SOFIA','CAMPO','REVOLLO',
   'fscampo@redboston.edu.co','flaviocampoespinoza@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'JUAN JOSE CANAL PEREZ',
   'JUAN','JOSE','CANAL','PEREZ',
   'jjcanal@redboston.edu.co','luzperezt@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'DANIELA CASTRO PEÑARANDA',
   'DANIELA',NULL,'CASTRO','PEÑARANDA',
   'daniellacastro@redboston.edu.co','karenpenaranda@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'CARLOS MIGUEL CASTRO VELEZ',
   'CARLOS','MIGUEL','CASTRO','VELEZ',
   'carloscastro@redboston.edu.co','karenvelez@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'ALEJANDRO CELANO SOLIS',
   'ALEJANDRO',NULL,'CELANO','SOLIS',
   'alejandrocs@redboston.edu.co','giannysolisgarcia@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'ALEJANDRO DE LA CRUZ PALMA',
   'ALEJANDRO',NULL,'DE LA CRUZ','PALMA',
   'dalejandro@redboston.edu.co','anapalmarodriguez@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'ALEXANDER DAVID DUARTE VEGA',
   'ALEXANDER','DAVID','DUARTE','VEGA',
   'adduarte@redboston.edu.co','amadarosavegadeangel@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'JUAN SEBASTIAN ECHEVERRIA DE LA HOZ',
   'JUAN','SEBASTIAN','ECHEVERRIA','DE LA HOZ',
   'jsecheverria@redboston.edu.co','highschoolpsychologist@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'RENATA ISABEL FIGUEROA MOLINA',
   'RENATA','ISABEL','FIGUEROA','MOLINA',
   'renatafigueroa@redboston.edu.co','yumismolina@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'ESTEBAN GARCES OSPINO',
   'ESTEBAN',NULL,'GARCES','OSPINO',
   'estebangarces@redboston.edu.co','omargarces@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'SAMUEL GARCIA LOPERA',
   'SAMUEL',NULL,'GARCIA','LOPERA',
   'samuelgarcia@redboston.edu.co','andresfelipegarcia@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'MARTIN GOMEZ ORTEGA',
   'MARTIN',NULL,'GOMEZ','ORTEGA',
   'martingomez@redboston.edu.co','kellyortegavalega@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'THALIANA SOFIA GOMEZ PORRAS',
   'THALIANA','SOFIA','GOMEZ','PORRAS',
   'tsgomez@redboston.edu.co','middaliaporrasberdugo@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'HELEN SOFIA GONZALEZ TORRES',
   'HELEN','SOFIA','GONZALEZ','TORRES',
   'helegonzalez@redboston.edu.co','lilianatorres@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'JORDAN SAID GUERRERO BELTRAN',
   'JORDAN','SAID','GUERRERO','BELTRAN',
   'jsguerrero@redboston.edu.co','gracetatianabeltrangonzalez@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'SHADDAI GUTIERREZ COLLANTE',
   'SHADDAI',NULL,'GUTIERREZ','COLLANTE',
   'sgutierrez@redboston.edu.co','yeimicollantegonzalez@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'ISABELLA HERRERA GOMEZ',
   'ISABELLA',NULL,'HERRERA','GOMEZ',
   'iherrera@redboston.edu.co','dianagomezortiz@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'LINDA VALERIA JIMENEZ RIVADENEIRA',
   'LINDA','VALERIA','JIMENEZ','RIVADENEIRA',
   'lindajimenez@redboston.edu.co','lindarivadeneira@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'LEANDRO MONTERROSA PACHECO',
   'LEANDRO',NULL,'MONTERROSA','PACHECO',
   'lmonterrosap@redboston.edu.co','yoshirapachecorodriguez@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'MATEO MUÑOZ TORNETH',
   'MATEO',NULL,'MUÑOZ','TORNETH',
   'mateomunoz@redboston.edu.co','sandratorneth@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'EMILY NIETO SOLORZANO',
   'EMILY',NULL,'NIETO','SOLORZANO',
   'emilynieto@redboston.edu.co','kellysolorzano@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'EMANUEL ORDOÑEZ QUINTERO',
   'EMANUEL',NULL,'ORDOÑEZ','QUINTERO',
   'emanuelordonez@redboston.edu.co','erikaquintero@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'ISABELLA SOFIA PRADA GOMEZ',
   'ISABELLA','SOFIA','PRADA','GOMEZ',
   'isabellaprada@redboston.edu.co','lilianagomez@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'MARIA ANGEL PRIMO ESCORCIA',
   'MARIA','ANGEL','PRIMO','ESCORCIA',
   'ma-primo@redboston.edu.co','silvanaescorciapayares@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'DANIELA SOFIA RAMIREZ BAUQUEZ',
   'DANIELA','SOFIA','RAMIREZ','BAUQUEZ',
   'dsramirez@redboston.edu.co','jairoramirez@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'JUAN ANDRES ROBLES PEREZ',
   'JUAN','ANDRES','ROBLES','PEREZ',
   'jarobles@redboston.edu.co','ninamariaperezduarte@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'KEVIN DANIEL ROHENEZ CUELLO',
   'KEVIN','DANIEL','ROHENEZ','CUELLO',
   'kevinrohenez@redboston.edu.co','lizethcuello@redboston.edu.co','7.°','Blue'),

  (v_school, v_tid, 'LUCIANA SILVERA DEL CASTILLO',
   'LUCIANA',NULL,'SILVERA','DEL CASTILLO',
   'lsilvera@redboston.edu.co','davidadriansilveranavas@redboston.edu.co','7.°','Blue'),

  -- ════════════════════════════════════════
  -- 8.° BLUE
  -- ════════════════════════════════════════
  (v_school, v_tid, 'FIORELLA ARONNA CAMPO',
   'FIORELLA',NULL,'ARONNA','CAMPO',
   'fiorellaaronna@redboston.edu.co','francoaronna@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'MATHIAS BELLO PIRAQUIVE',
   'MATHIAS',NULL,'BELLO','PIRAQUIVE',
   'mathiasbello@redboston.edu.co','yerlispiraquive@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'DANETTE SOFIA CAICEDO MONTES',
   'DANETTE','SOFIA','CAICEDO','MONTES',
   'danette@redboston.edu.co','mayerlismontes@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'JUAN SEBASTIAN CALVO VALEGA',
   'JUAN','SEBASTIAN','CALVO','VALEGA',
   'juan.s.calvo@redboston.edu.co','paola.b.valega@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'DIEGO CASTILLA ORDOÑEZ',
   'DIEGO',NULL,'CASTILLA','ORDOÑEZ',
   'diegocastilla@redboston.edu.co','lissetteordonez@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'SEBASTIAN JOSE CASTRO REALES',
   'SEBASTIAN','JOSE','CASTRO','REALES',
   'sebastiancas@redboston.edu.co','josecastrotor@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'GABRIELA DIAZ CASTRO',
   'GABRIELA',NULL,'DIAZ','CASTRO',
   'gabrieladiaz@redboston.edu.co','mayradecastroc@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'LIONEL MATHIAS FLORIANO MARTINEZ',
   'LIONEL','MATHIAS','FLORIANO','MARTINEZ',
   'lionelfloriano@redboston.edu.co','claudiapmartinez@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'VALERIE LIZARAZO LLANOS',
   'VALERIE',NULL,'LIZARAZO','LLANOS',
   'valerielizarazo@redboston.edu.co','gonzalolizarazomejia@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'SOFIA ISABEL MARADEI BELEÑO',
   'SOFIA','ISABEL','MARADEI','BELEÑO',
   'sofiamaradey@redboston.edu.co','jmaradei@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'SAMUEL DAVID NIÑO ROMERO',
   'SAMUEL','DAVID','NIÑO','ROMERO',
   'samuel@redboston.edu.co','maricarmen@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'MIGUEL ANGEL PANCIERA DIZZOPOLA',
   'MIGUEL','ANGEL','PANCIERA','DIZZOPOLA',
   'miguelpanciera@redboston.edu.co','miguelpancieradizoppola@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'LUCIANA SOFIA PEDRAZA MEDRANO',
   'LUCIANA','SOFIA','PEDRAZA','MEDRANO',
   'lucianapedraza@redboston.edu.co','brendamedrano@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'SARAH PAOLA PEREZ AHUMADA',
   'SARAH','PAOLA','PEREZ','AHUMADA',
   'sarahperez@redboston.edu.co','vanessaahumadasarmiento@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'SAMUEL PORTO RANGEL',
   'SAMUEL',NULL,'PORTO','RANGEL',
   'samuelporto@redboston.edu.co','julydayanarangelpedriquez@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'JOSE ALEJANDRO QUINTERO PUENTES',
   'JOSE','ALEJANDRO','QUINTERO','PUENTES',
   'jose@redboston.edu.co','yennis@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'VALENTINA REYES COHEN',
   'VALENTINA',NULL,'REYES','COHEN',
   'valentinareyes@redboston.edu.co','andreacohenp@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'NADIA RODRIGUEZ CADAVID',
   'NADIA',NULL,'RODRIGUEZ','CADAVID',
   'nadiarodriguez@redboston.edu.co','caturrodriguez@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'KENDALL ROJANO OROZCO',
   'KENDALL',NULL,'ROJANO','OROZCO',
   'kendallrojano@redboston.edu.co','karenpatriciaorozcorojas@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'SAMUEL SABALZA BERMUDEZ',
   'SAMUEL',NULL,'SABALZA','BERMUDEZ',
   'samuelsabalza@redboston.edu.co','elvinsabalzabellido@redboston.edu.co','8.°','Blue'),

  (v_school, v_tid, 'EMANUEL SIERRA SIERRA',
   'EMANUEL',NULL,'SIERRA','SIERRA',
   'eesierra@redboston.edu.co','karynpsierra@redboston.edu.co','8.°','Blue'),

  -- ════════════════════════════════════════
  -- 8.° RED
  -- ════════════════════════════════════════
  (v_school, v_tid, 'ALEJANDRA ALVAREZ GONZALEZ',
   'ALEJANDRA',NULL,'ALVAREZ','GONZALEZ',
   'alejandraalvarez@redboston.edu.co','alexandragonzalez@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'SOFIA AREVALO MINDIOLA',
   'SOFIA',NULL,'AREVALO','MINDIOLA',
   'sofiaarevalomin@redboston.edu.co','arturoarevalo@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'VICTORIA ARIZA SALAS',
   'VICTORIA',NULL,'ARIZA','SALAS',
   'victorias@redboston.edu.co','marlys@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'JOSE MANUEL CASTELLON ENSUNCHO',
   'JOSE','MANUEL','CASTELLON','ENSUNCHO',
   'josecastellon@redboston.edu.co','johannaensunchohernandez@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'ANDRES CHIMA MAESTRE',
   'ANDRES',NULL,'CHIMA','MAESTRE',
   'andreschima@redboston.edu.co','luisjchimadachi@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'CRISTINA CONTRERAS RADA',
   'CRISTINA',NULL,'CONTRERAS','RADA',
   'cristinacontreras@redboston.edu.co','jheisoncontreras@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'SUSAN GABRIELA CRESPO RICARDO',
   'SUSAN','GABRIELA','CRESPO','RICARDO',
   'susancrespo@redboston.edu.co','carmenricardobarreto@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'VIVIAN NAOMY GIL GOMEZ',
   'VIVIAN','NAOMY','GIL','GOMEZ',
   'viviangil@redboston.edu.co','anagomez@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'ANDRES CAMILO GONZALEZ RESTREPO',
   'ANDRES','CAMILO','GONZALEZ','RESTREPO',
   'andresgonzalez@redboston.edu.co','sandrarestrepo@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'NICOLLE MANOSALVA YALI',
   'NICOLLE',NULL,'MANOSALVA','YALI',
   'nicolemanosalva@redboston.edu.co','mauriciomanosalvae@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'VALENTINO MARTINEZ CASTRO',
   'VALENTINO',NULL,'MARTINEZ','CASTRO',
   'valentinomartinez@redboston.edu.co','asaimmarcelacastrocastro@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'SARA MEZA YEPES',
   'SARA',NULL,'MEZA','YEPES',
   'sarameza@redboston.edu.co','karenpaolayepesalvis@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'JUAN SEBASTIAN ORTIZ VIDAL',
   'JUAN','SEBASTIAN','ORTIZ','VIDAL',
   'juanseortiz@redboston.edu.co','lilibethvidalpalma@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'MATEO RAUL PACHON TAPIAS',
   'MATEO','RAUL','PACHON','TAPIAS',
   'mateopachon@redboston.edu.co','milenatapias@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'MARIANA PAREJA PEDRAZA',
   'MARIANA',NULL,'PAREJA','PEDRAZA',
   'marianapareja@redboston.edu.co','erikapedraza@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'MOISES POMARICO CASDIEGO',
   'MOISES',NULL,'POMARICO','CASDIEGO',
   'moisespomarico@redboston.edu.co','ivannodejesuspomaricoramos@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'SANTIAGO PORTO RANGEL',
   'SANTIAGO',NULL,'PORTO','RANGEL',
   'santiagoporto@redboston.edu.co','julydayanarangelpedriquez@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'ISABEL SOFIA PUA MUÑOZ',
   'ISABEL','SOFIA','PUA','MUÑOZ',
   'isabelpua@redboston.edu.co','jonathanpua@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'MARYANN RENTERIA PRENS',
   'MARYANN',NULL,'RENTERIA','PRENS',
   'maryannrenteria@redboston.edu.co','dianoraprensg@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'JUAN ESTEBAN ROMERO OROZCO',
   'JUAN','ESTEBAN','ROMERO','OROZCO',
   'juanesromero@redboston.edu.co','madindelcarmenorozcoangarita@redboston.edu.co','8.°','Red'),

  (v_school, v_tid, 'DANNA SARMIENTO GONZALEZ',
   'DANNA',NULL,'SARMIENTO','GONZALEZ',
   'dannasarmiento@redboston.edu.co','emilcegonzalezprada@redboston.edu.co','8.°','Red'),

  -- ════════════════════════════════════════
  -- 9.° BLUE
  -- ════════════════════════════════════════
  (v_school, v_tid, 'JOSUE ABUDINEM QUINTERO',
   'JOSUE',NULL,'ABUDINEM','QUINTERO',
   'josueabudinen@redboston.edu.co','alfonsoabudinen@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'CAMILA ARIZA RUIZ',
   'CAMILA',NULL,'ARIZA','RUIZ',
   'camilaa@redboston.edu.co','wilmanarizac@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'ALEJANDRA SOFIA ATENCIO MORALES',
   'ALEJANDRA','SOFIA','ATENCIO','MORALES',
   'alejandraatencio@redboston.edu.co','larryjoseatenciourbina@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'GABRIELA AVILA SANTIS',
   'GABRIELA',NULL,'AVILA','SANTIS',
   'gabrielaavila@redboston.edu.co','sandraluciaavilasantis@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'ANA PAULINA AVILEZ SOLANO',
   'ANA','PAULINA','AVILEZ','SOLANO',
   'anaavilez@redboston.edu.co','paulinasolano@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'MATIAS ANDRES BENEDETTY SANCHEZ',
   'MATIAS','ANDRES','BENEDETTY','SANCHEZ',
   'matiasbenedetti@redboston.edu.co','marysolsanchezmolina@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'ABBY SARAYS BUELVAS REALES',
   'ABBY','SARAYS','BUELVAS','REALES',
   'abbybuelvas@redboston.edu.co','norlisastridrealesgarceranth@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'SANTIAGO CABRERA CAYON',
   'SANTIAGO',NULL,'CABRERA','CAYON',
   'santiagocabrera@redboston.edu.co','edgardoantoniocabrerabolivar@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'KEVIN JESUS CAMPO BERNAL',
   'KEVIN','JESUS','CAMPO','BERNAL',
   'kevincampo@redboston.edu.co','karlabernalalarcon@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'ISABELLA CARDOZA MARTINEZ',
   'ISABELLA',NULL,'CARDOZA','MARTINEZ',
   'isabellacardoza@redboston.edu.co','ecardoza@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'SALOME CARRILLO SUAREZ',
   'SALOME',NULL,'CARRILLO','SUAREZ',
   'salomecarrillo@redboston.edu.co','katherinesuarezflorez@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'SANTIAGO DURAN ALVAREZ',
   'SANTIAGO',NULL,'DURAN','ALVAREZ',
   'santiagoduran@redboston.edu.co','silvanaalvarezherrera@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'JESUS DAVID ESPRIELLA VARGAS',
   'JESUS','DAVID','ESPRIELLA','VARGAS',
   'jesusespriella@redboston.edu.co','javierjesusespriellacera@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'SALOME GARCIA LOPERA',
   'SALOME',NULL,'GARCIA','LOPERA',
   'salomegarcia@redboston.edu.co','andresfelipegarcia@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'ANDREA FERNANDA GONZALEZ ALVAREZ',
   'ANDREA','FERNANDA','GONZALEZ','ALVAREZ',
   'andreagonzalez@redboston.edu.co','xiomarysalvarez@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'SALMA SOFIA JIMENEZ RIVADENEIRA',
   'SALMA','SOFIA','JIMENEZ','RIVADENEIRA',
   'salmajimenezrivadeneira@redboston.edu.co','lindarivadeneira@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'ISABELLA SOFIA MACIAS TORRENEGRA',
   'ISABELLA','SOFIA','MACIAS','TORRENEGRA',
   'isabellamaciast@redboston.edu.co','inmaculadats@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'GABRIEL MARTINEZ LOPEZ',
   'GABRIEL',NULL,'MARTINEZ','LOPEZ',
   'gabrielmartinez@redboston.edu.co','marisollopez@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'ARIANNA MARTINEZ PASCUALES',
   'ARIANNA',NULL,'MARTINEZ','PASCUALES',
   'ariannamartinez@redboston.edu.co','dianapascualesc@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'SEBASTIAN EDUARDO PEDROZA TORRES',
   'SEBASTIAN','EDUARDO','PEDROZA','TORRES',
   'sebastianpedroza@redboston.edu.co','nelcytorres@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'LEANDRO SCHIFINO RAMIREZ',
   'LEANDRO',NULL,'SCHIFINO','RAMIREZ',
   'leandroschifino@redboston.edu.co','mariacramirezmedina@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'MARIANA SOPHIA SUAREZ ROMERO',
   'MARIANA','SOPHIA','SUAREZ','ROMERO',
   'marianasuarez@redboston.edu.co','rubensuarezrodriguez@redboston.edu.co','9.°','Blue'),

  (v_school, v_tid, 'MARIA LUCIA TRESPALACIOS LARIOS',
   'MARIA','LUCIA','TRESPALACIOS','LARIOS',
   'mariatrespalacio@redboston.edu.co','jeffrytrespalaciolafaurie@redboston.edu.co','9.°','Blue'),

  -- ════════════════════════════════════════
  -- 9.° RED
  -- ════════════════════════════════════════
  (v_school, v_tid, 'SEBASTIAN ALARCON OROZCO',
   'SEBASTIAN',NULL,'ALARCON','OROZCO',
   'sebastianalarcon@redboston.edu.co','andresalarconjaramillo@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'VICTORIA ARBELAEZ LAMADRID',
   'VICTORIA',NULL,'ARBELAEZ','LAMADRID',
   'victoriaarbelaez@redboston.edu.co','veronicalamadrid@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'SOPHIA BARROS LOPEZ',
   'SOPHIA',NULL,'BARROS','LOPEZ',
   'sophiabarros@redboston.edu.co','linavanessalopezalcendra@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'SOFIA CARDENAS BALLESTEROS',
   'SOFIA',NULL,'CARDENAS','BALLESTEROS',
   'sofiacardenasb@redboston.edu.co','barbaraballesteros@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'LUCIANA CARRILLO SUAREZ',
   'LUCIANA',NULL,'CARRILLO','SUAREZ',
   'lucianacarrillo@redboston.edu.co','katherinesuarezflorez@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'MARILYN SOFIA CHAPARRO DE LA HOZ',
   'MARILYN','SOFIA','CHAPARRO','DE LA HOZ',
   'marilynchaparro@redboston.edu.co','michaelchaparro@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'ANDRES FELIPE DIAZ GUZMAN',
   'ANDRES','FELIPE','DIAZ','GUZMAN',
   'andresfdiaz@redboston.edu.co','adrianaguzman@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'SOPHIE ISABELLE ESCOBAR BORRERO',
   'SOPHIE','ISABELLE','ESCOBAR','BORRERO',
   'sophieescobar@redboston.edu.co','doloresisabelborreroverdooren@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'JUAN ESTEBAN GARCIA SERRANO',
   'JUAN','ESTEBAN','GARCIA','SERRANO',
   'juangarcia@redboston.edu.co','katherineserranoracines@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'MATIAS ANGEL IBAÑEZ GUERRA',
   'MATIAS','ANGEL','IBAÑEZ','GUERRA',
   'mathiasibanez@redboston.edu.co','eddyibanezballesteros@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'MATIAS INSIGNARES HINCAPIE',
   'MATIAS',NULL,'INSIGNARES','HINCAPIE',
   'matiasinsignares@redboston.edu.co','lilijohannahincapiecalvo@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'MIGUEL ANDRES JIMENEZ CERVANTES',
   'MIGUEL','ANDRES','JIMENEZ','CERVANTES',
   'migueljimenez@redboston.edu.co','kattylorenacervantesperez@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'ELIZABETH DEL CARMEN MALAVER FLORIAN',
   'ELIZABETH','DEL CARMEN','MALAVER','FLORIAN',
   'emalaver@redboston.edu.co','miguelmalaver@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'DANNA SOFIA MEDINA ROMERO',
   'DANNA','SOFIA','MEDINA','ROMERO',
   'dannamedina@redboston.edu.co','maryromero@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'KARLA ALEJANDRA MEDINA VILLANUEVA',
   'KARLA','ALEJANDRA','MEDINA','VILLANUEVA',
   'karlamedina@redboston.edu.co','jairjosemendozaruiz@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'ESTEBAN DE JESUS MUÑOZ RODELO',
   'ESTEBAN','DE JESUS','MUÑOZ','RODELO',
   'estebanmunoz@redboston.edu.co','patriciarodelo@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'MARIANA SOFIA NIGRO MANOTAS',
   'MARIANA','SOFIA','NIGRO','MANOTAS',
   'mariananigro@redboston.edu.co','edwinigro@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'DANIEL JESUS PINTO CENTENO',
   'DANIEL','JESUS','PINTO','CENTENO',
   'danielpinto@redboston.edu.co','jacquelinecenteno@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'ELIAS QUINTERO GONZALES',
   'ELIAS',NULL,'QUINTERO','GONZALES',
   'eliasquintero@redboston.edu.co','lizzetteyamilegonzalezrocha@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'KEY STEPHANIE ROHENEZ CUELLO',
   'KEY','STEPHANIE','ROHENEZ','CUELLO',
   'keyrohenez@redboston.edu.co','lizethcuello@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'SOFIA VALENTINA SAAVEDRA UJUETA',
   'SOFIA','VALENTINA','SAAVEDRA','UJUETA',
   'sofiasaavedra@redboston.edu.co','silvanaujuetaorozco@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'JUAN SEBASTIAN SANCHEZ ROJAS',
   'JUAN','SEBASTIAN','SANCHEZ','ROJAS',
   'juansanchez@redboston.edu.co','rosalbarojascorrea@redboston.edu.co','9.°','Red'),

  -- ⚠ Email NULL: conflicto con SANCHEZ ROJAS (juansanchez@redboston.edu.co)
  -- El docente debe asignar el correo correcto vía /students → Correos
  (v_school, v_tid, 'MATEO SARMIENTO ROJANO',
   'MATEO',NULL,'SARMIENTO','ROJANO',
   NULL,'tatianarojanodelassalas@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'SOFIA VITOLA CARRASCAL',
   'SOFIA',NULL,'VITOLA','CARRASCAL',
   'sofiavitola@redboston.edu.co','cindicarrascalguillin@redboston.edu.co','9.°','Red'),

  (v_school, v_tid, 'ALEJANDRO DAVID YEPES PACHECO',
   'ALEJANDRO','DAVID','YEPES','PACHECO',
   'alejandroyepes@redboston.edu.co','leonardyepesestrada@redboston.edu.co','9.°','Red'),

  -- ════════════════════════════════════════
  -- 10.° BLUE
  -- ════════════════════════════════════════
  (v_school, v_tid, 'GABRIELA ANAYA LOPEZ',
   'GABRIELA',NULL,'ANAYA','LOPEZ',
   'gabrielaanaya@redboston.edu.co','reginaineslopezherrera@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'JUAN PABLO ANDRADE BOLIVAR',
   'JUAN','PABLO','ANDRADE','BOLIVAR',
   'jpandrade@redboston.edu.co','jacquelinebolivarmendez@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'CRYSTAL ARISTIZABAL PONCE',
   'CRYSTAL',NULL,'ARISTIZABAL','PONCE',
   'crystalaristizabal@redboston.edu.co','clauponce@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'SAMUEL DAVID ARTETA INSIGNARES',
   'SAMUEL','DAVID','ARTETA','INSIGNARES',
   'samuelarteta@redboston.edu.co','arielalexanderartetagranados@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'CARLOS MARIO BOTERO HARNES',
   'CARLOS','MARIO','BOTERO','HARNES',
   'carlosmbotero@redboston.edu.co','monicaharnes@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'MARIA LORENA CAMARGO CORONELL',
   'MARIA','LORENA','CAMARGO','CORONELL',
   'mariacamargo@redboston.edu.co','jorgemariocamargopadilla@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'SOFIA SHALOM CARO BERMUDEZ',
   'SOFIA','SHALOM','CARO','BERMUDEZ',
   'sofiacaro@redboston.edu.co','rafaelarturocaroamaris@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'ESTEBAN CELANO SOLIS',
   'ESTEBAN',NULL,'CELANO','SOLIS',
   'estebancelano@redboston.edu.co','giannysolisgarcia@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'NELSON ANDRES CONSUEGRA TROCONIS',
   'NELSON','ANDRES','CONSUEGRA','TROCONIS',
   'nelsonconsuegra@redboston.edu.co','mariatroconisruiz@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'SILVIA ROSA ECHEVERRIA ROMERO',
   'SILVIA','ROSA','ECHEVERRIA','ROMERO',
   'silviaecheverria@redboston.edu.co','silviaecheverria@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'SEBASTIAN GARCES OSPINO',
   'SEBASTIAN',NULL,'GARCES','OSPINO',
   'sebastiangarces@redboston.edu.co','omargarces@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'JUAN MARTIN GARCIA CARVAJAL',
   'JUAN','MARTIN','GARCIA','CARVAJAL',
   'juanmgarcia@redboston.edu.co','nancyluciacarvajalramirez@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'HANNA SOFIA GARCIA GUERRA',
   'HANNA','SOFIA','GARCIA','GUERRA',
   'hannagarcia@redboston.edu.co','anamguerra@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'ISABELLA GONZALEZ ARTEAGA',
   'ISABELLA',NULL,'GONZALEZ','ARTEAGA',
   'isabellagonzalez@redboston.edu.co','anamarteagacontreras@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'VICTOR JOSE HIDALGO BERMUDEZ',
   'VICTOR','JOSE','HIDALGO','BERMUDEZ',
   'victor.j.hidalgo@redboston.edu.co','michellebermudez@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'SHARON LADINO ZULUAGA',
   'SHARON',NULL,'LADINO','ZULUAGA',
   'sharonladino@redboston.edu.co','sandrazuluaga@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'JACOBO LAMUS PEÑUELA',
   'JACOBO',NULL,'LAMUS','PEÑUELA',
   'jacobolamus@redboston.edu.co','marthapenuela@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'ISABELL MARTINEZ AGUAS',
   'ISABELL',NULL,'MARTINEZ','AGUAS',
   'isabelmartinez@redboston.edu.co','karenaguasdelaossa@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'MARIANA MARTINEZ TERRIOS',
   'MARIANA',NULL,'MARTINEZ','TERRIOS',
   'marianamartinez@redboston.edu.co','mauryterriosfigueredo@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'ISABELLA NORIEGA SIERRA',
   'ISABELLA',NULL,'NORIEGA','SIERRA',
   'isabellanoriega@redboston.edu.co','cristiannoriegajimenez@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'GIANNELLA PANCIERA DI ZOPPOLA BARROS',
   'GIANNELLA',NULL,'PANCIERA DI ZOPPOLA','BARROS',
   'giannelladizoppola@redboston.edu.co','miguelpancieradizoppola@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'MARIA DEL PILAR PEREZ DIAZ',
   'MARIA','DEL PILAR','PEREZ','DIAZ',
   'mariadelpilar@redboston.edu.co','nataliadiazcoronell@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'CAMILO ROJANO OROZCO',
   'CAMILO',NULL,'ROJANO','OROZCO',
   'camilorojano@redboston.edu.co','karenpatriciaorozcorojas@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'DANNA RUBIO OSORIO',
   'DANNA',NULL,'RUBIO','OSORIO',
   'dannarubio@redboston.edu.co','karenosorio@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'LEHAYM SANABRIA CASTILLO',
   'LEHAYM',NULL,'SANABRIA','CASTILLO',
   'lehaymsan@redboston.edu.co','karinacastillo@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'JUAN DAVID SANDOVAL HERRERA',
   'JUAN','DAVID','SANDOVAL','HERRERA',
   'jdsandoval@redboston.edu.co','adrianaherrera@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'JOSE ALEJANDRO VARGAS GOMEZ',
   'JOSE','ALEJANDRO','VARGAS','GOMEZ',
   'josevargas@redboston.edu.co','lilianagomezsanchez@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'ASAEL VERGARA CARRILLO',
   'ASAEL',NULL,'VERGARA','CARRILLO',
   'asaelvergara@redboston.edu.co','alexandracarrillowao@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'SEBASTIAN ANDRES GONZALEZ CARO',
   'SEBASTIAN','ANDRES','GONZALEZ','CARO',
   'sgonzalez@redboston.edu.co','sandracarogonzalez@redboston.edu.co','10.°','Blue'),

  (v_school, v_tid, 'MARIANA MARTINEZ VITAL',
   'MARIANA',NULL,'MARTINEZ','VITAL',
   'marianamartinezv@redboston.edu.co','lilianvitalmejia@redboston.edu.co','10.°','Blue'),

  -- ════════════════════════════════════════
  -- 10.° RED
  -- ════════════════════════════════════════
  (v_school, v_tid, 'VALERIA ACERO HERNANDEZ',
   'VALERIA',NULL,'ACERO','HERNANDEZ',
   'valeriaacero@redboston.edu.co','deliahernandezmejia@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'ANGELICA MARIA ACOSTA ARMENTA',
   'ANGELICA','MARIA','ACOSTA','ARMENTA',
   'angelicaacosta@redboston.edu.co','adrianapaolaarmentaariza@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'LIXE SHADANNY BELEÑO PEÑA',
   'LIXE','SHADANNY','BELEÑO','PEÑA',
   'lixebeleno@redboston.edu.co','sandrapena@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'SAMUEL DAVID BENEDETTY SANCHEZ',
   'SAMUEL','DAVID','BENEDETTY','SANCHEZ',
   'samuelbenedetti@redboston.edu.co','marysolsanchezmolina@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'ALVARO CABALLERO CABALLERO',
   'ALVARO',NULL,'CABALLERO','CABALLERO',
   'alvarocaballero@redboston.edu.co','alvaroenriquecaballerodiaz@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'JOSHUA CAPARROSO CUESTA',
   'JOSHUA',NULL,'CAPARROSO','CUESTA',
   'joshuacaparroso@redboston.edu.co','javiercaparroso@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'LUCIANA CONSUEGRA OLARTE',
   'LUCIANA',NULL,'CONSUEGRA','OLARTE',
   'lucianaconsuegra@redboston.edu.co','jjconsuegra@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'LUCAS DELGADO CASTRO',
   'LUCAS',NULL,'DELGADO','CASTRO',
   'ldelgadoc@redboston.edu.co','carolinacastrogutierrez@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'VALERIA DIAZ BELEÑO',
   'VALERIA',NULL,'DIAZ','BELEÑO',
   'valeriadiaz@redboston.edu.co','indirabelenorico@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'EDWIN JULIAN FERRER RUIZ',
   'EDWIN','JULIAN','FERRER','RUIZ',
   'edwinferrer@redboston.edu.co','kaffyruiz@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'VALERIE ISABELL GOMEZ HERRERA',
   'VALERIE','ISABELL','GOMEZ','HERRERA',
   'valeriegomez@redboston.edu.co','fiorelladeurquijo@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'CAMILA GOMEZ PARRA',
   'CAMILA',NULL,'GOMEZ','PARRA',
   'camilagomez@redboston.edu.co','sandraparrach@redboston.edu.co','10.°','Red'),

  -- ⚠ Sin correo en los datos originales — el docente debe ingresar vía /students → Correos
  (v_school, v_tid, 'MARIA JULIANA BARRAZA ACUÑA',
   'MARIA','JULIANA','BARRAZA','ACUÑA',
   NULL,NULL,'10.°','Red'),

  (v_school, v_tid, 'JOSE IGNACIO GONZALEZ PEREZ',
   'JOSE','IGNACIO','GONZALEZ','PEREZ',
   'josegonzalesperez@redboston.edu.co','emilsenoemiperez@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'SAMUEL DAVID LOZANO SIERRA',
   'SAMUEL','DAVID','LOZANO','SIERRA',
   'samuellozano@redboston.edu.co','jhuzdithsierra@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'MATIAS MURCIA BOTERO',
   'MATIAS',NULL,'MURCIA','BOTERO',
   'matiasmurcia@redboston.edu.co','yuripatriciaboterocastro@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'DAVID ELIAS NAVARRO RAAD',
   'DAVID','ELIAS','NAVARRO','RAAD',
   'davidnavarro@redboston.edu.co','secretaria1bf@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'VICTORIA LUCIA PAJARO NAVARRO',
   'VICTORIA','LUCIA','PAJARO','NAVARRO',
   'victoriapajaro@redboston.edu.co','linajnavarro@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'SANTIAGO JOSE PLAZA TABOADA',
   'SANTIAGO','JOSE','PLAZA','TABOADA',
   'santiagoplaza@redboston.edu.co','yerlisluztaboadapineda@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'EDILBERTO RAMOS CONTRERAS',
   'EDILBERTO',NULL,'RAMOS','CONTRERAS',
   'edilbertoramos@redboston.edu.co','lilibethcontrerasch@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'DIEGO ALEJANDRO SALAZAR ARISTIZABAL',
   'DIEGO','ALEJANDRO','SALAZAR','ARISTIZABAL',
   'diegosalazar@redboston.edu.co','yanedaristizabalg@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'ALBERTO MARIO SALGADO CONTRERAS',
   'ALBERTO','MARIO','SALGADO','CONTRERAS',
   'albertosalgado@redboston.edu.co','elizabethcontreras@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'PAULA ANDREA SANCHEZ PINEDA',
   'PAULA','ANDREA','SANCHEZ','PINEDA',
   'paulasanchez@redboston.edu.co','kellyngpineda@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'SAMUEL ANDRES TEJADA EMILIANI',
   'SAMUEL','ANDRES','TEJADA','EMILIANI',
   'samueltejada@redboston.edu.co','heidyemiliani@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'DANIEL DAVID URIBE URIBE',
   'DANIEL','DAVID','URIBE','URIBE',
   'danieluribe@redboston.edu.co','mariauribenieto@redboston.edu.co','10.°','Red'),

  (v_school, v_tid, 'ISABELLA VILLA VERGARA',
   'ISABELLA',NULL,'VILLA','VERGARA',
   'isabellavilla@redboston.edu.co','eduardovillamozo@redboston.edu.co','10.°','Red'),

  -- ════════════════════════════════════════
  -- 11.° BLUE
  -- ════════════════════════════════════════
  (v_school, v_tid, 'SANTIAGO JAVIER AHUMADA PEREZ',
   'SANTIAGO','JAVIER','AHUMADA','PEREZ',
   'santiagoahumada@redboston.edu.co','marlynperez@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'MARIA CLAUDIA ALVAREZ JIMENEZ',
   'MARIA','CLAUDIA','ALVAREZ','JIMENEZ',
   'maalvarezj@redboston.edu.co','claudiajimenez@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'CAMILA ANDREA ARRIETA GONZALEZ',
   'CAMILA','ANDREA','ARRIETA','GONZALEZ',
   'camilaarr@redboston.edu.co','kellygonzalezpei@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'DAVID SANTIAGO BONILLA SAAVEDRA',
   'DAVID','SANTIAGO','BONILLA','SAAVEDRA',
   'savidsantiagobonillasaavedra@redboston.edu.co','yadirasaavedra@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'ALFREDO DE JESUS CAMARGO PEREZ',
   'ALFREDO','DE JESUS','CAMARGO','PEREZ',
   'alfredodejesusc@redboston.edu.co','deyaniraperezjaramillo@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'SARA JANETH CASALLAS REYES',
   'SARA','JANETH','CASALLAS','REYES',
   'saracasallas@redboston.edu.co','yanethreyes@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'JOSE RAFAEL CASTELLON ENSUNCHO',
   'JOSE','RAFAEL','CASTELLON','ENSUNCHO',
   'joserafcastellon@redboston.edu.co','johannaensunchohernandez@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'JOSE ALEJANDRO CASTRO ALVAREZ',
   'JOSE','ALEJANDRO','CASTRO','ALVAREZ',
   'josealcastro@redboston.edu.co','juliocastrocastro@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'JUAN DAVID CASTRO OLIVA',
   'JUAN','DAVID','CASTRO','OLIVA',
   'juandavidcastro@redboston.edu.co','juanfernandocastrosierra@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'MARYANA CORDOBA GAMERO',
   'MARYANA',NULL,'CORDOBA','GAMERO',
   'marianacordoba@redboston.edu.co','rosanamartinagameropertuz@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'HADASSA DE LIRA RODRIGUES',
   'HADASSA',NULL,'DE LIRA','RODRIGUES',
   'hadassadelira@redboston.edu.co','jacilenedelirarodrigues@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'JOHN DAVID DOMINGUEZ RODRIGUEZ',
   'JOHN','DAVID','DOMINGUEZ','RODRIGUEZ',
   'jhondaviddominguez@redboston.edu.co','jdominguez@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'EMANUEL FERRER ANAYA',
   'EMANUEL',NULL,'FERRER','ANAYA',
   'emanuelferrer@redboston.edu.co','sandra-anaya@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'CAMILO ANDRES GALVIS COBA',
   'CAMILO','ANDRES','GALVIS','COBA',
   'camilogalviscoba@redboston.edu.co','yessicacoba@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'JUAN CAMILO GARCIA SERRANO',
   'JUAN','CAMILO','GARCIA','SERRANO',
   'juancamilogarcia@redboston.edu.co','katherineserranoracines@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'ANA ISABELLE GIL GOMEZ',
   'ANA','ISABELLE','GIL','GOMEZ',
   'anagil@redboston.edu.co','anagomez@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'NATALIA SOPHIA GOMEZ GUARIN',
   'NATALIA','SOPHIA','GOMEZ','GUARIN',
   'nataliagomez@redboston.edu.co','jeniferdarylguarinromero@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'SOFIA CAMILA JIMENEZ PARADA',
   'SOFIA','CAMILA','JIMENEZ','PARADA',
   'sofiajimenez@redboston.edu.co','marthaparadanatera@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'SARA VALERIA MANJARRES TERRIOS',
   'SARA','VALERIA','MANJARRES','TERRIOS',
   'saramanjarres@redboston.edu.co','kelisterriosfigueredo@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'MICHELLE VALENTINA MARTINEZ NARANJO',
   'MICHELLE','VALENTINA','MARTINEZ','NARANJO',
   'michellemartinez@redboston.edu.co','juliethkatherinenaranjoflorez@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'HAYET MARIANELLA MASCO GARCIA',
   'HAYET','MARIANELLA','MASCO','GARCIA',
   'hayetmascogarcia@redboston.edu.co','michellegarcia@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'JULIO CESAR MOJICA ACOSTA',
   'JULIO','CESAR','MOJICA','ACOSTA',
   'juliocesarmojica@redboston.edu.co','jcmojica@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'ALEJANDRO ENRIQUE MONSALVE VARGAS',
   'ALEJANDRO','ENRIQUE','MONSALVE','VARGAS',
   'alejandromonsalve@redboston.edu.co','convivenciaprimaria@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'GABRIEL EDGARDO OLIVEROS PEREZ',
   'GABRIEL','EDGARDO','OLIVEROS','PEREZ',
   'gabrieloliveros@redboston.edu.co','soporteit@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'NICOLLE ORJUELA REYES',
   'NICOLLE',NULL,'ORJUELA','REYES',
   'nicolleorjuelareyes@redboston.edu.co','direccionacademica@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'ALEJANDRO PALMA GAVIRIA',
   'ALEJANDRO',NULL,'PALMA','GAVIRIA',
   'alejandropalma@redboston.edu.co','paolagaviria@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'SANTIAGO PEDRAZA NORIEGA',
   'SANTIAGO',NULL,'PEDRAZA','NORIEGA',
   'santiagopedrazanoriega@redboston.edu.co','saranoriegarevueltas@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'SHADYA SOFIA PEÑA TORRECILLA',
   'SHADYA','SOFIA','PEÑA','TORRECILLA',
   'shady.pena@redboston.edu.co','joelpena@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'SAMUEL JOSE PEÑA VILLADIEGO',
   'SAMUEL','JOSE','PEÑA','VILLADIEGO',
   'samuelpena@redboston.edu.co','naylavilladiegobettin@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'JESUS DANIEL PRIETO VELASQUEZ',
   'JESUS','DANIEL','PRIETO','VELASQUEZ',
   'jesusprieto@redboston.edu.co','rosanavelasquezcorbacho@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'SAMUEL ELIAS RAMOS ESPINOSA',
   'SAMUEL','ELIAS','RAMOS','ESPINOSA',
   'samuelramosespinosa@redboston.edu.co','yurikhilmarramospinzon@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'SANTIAGO ESTEBAN REY CERVANTES',
   'SANTIAGO','ESTEBAN','REY','CERVANTES',
   'santiagorey@redboston.edu.co','skarlyncervantesparejo@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'DANIEL ALEJANDRO RODRIGUEZ CHICA',
   'DANIEL','ALEJANDRO','RODRIGUEZ','CHICA',
   'danielrodriguez@redboston.edu.co','pabloemiliorodriguezosorio@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'MARIANGEL ROMERO LOPEZ',
   'MARIANGEL',NULL,'ROMERO','LOPEZ',
   'mariangelromero@redboston.edu.co','joseromeroarroyo@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'ALISSON DAYANA ROSANIA HELD',
   'ALISSON','DAYANA','ROSANIA','HELD',
   'alissonrosania@redboston.edu.co','shirleyheld@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'ISABELLA SOFIA SILVERA SANZ',
   'ISABELLA','SOFIA','SILVERA','SANZ',
   'isabellasilvera@redboston.edu.co','luzdalissanz@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'JEREMIE SUAREZ DIAZ',
   'JEREMIE',NULL,'SUAREZ','DIAZ',
   'jeremiesuarezdiaz@redboston.edu.co','esuarez@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'SANTIAGO ANDRES VERGARA SANDOVAL',
   'SANTIAGO','ANDRES','VERGARA','SANDOVAL',
   'santiagovergara@redboston.edu.co','leonardodavidvergarasalazar@redboston.edu.co','11.°','Blue'),

  (v_school, v_tid, 'CARLOS ARTURO ZULETA BLANCO',
   'CARLOS','ARTURO','ZULETA','BLANCO',
   'carloszuleta@redboston.edu.co','patriciablancomorales@redboston.edu.co','11.°','Blue')

  ON CONFLICT DO NOTHING;

END $$;
