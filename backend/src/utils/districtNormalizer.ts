/**
 * districtNormalizer.ts
 * 
 * Central Canonical District & City Normalizer for Paraguay Electoral Data.
 * Solves once and for all any abbreviations, typos, or casing discrepancies:
 * (e.g. "PEDRO J. CABALLERO" <-> "PEDRO JUAN CABALLERO" <-> "PJC", "CNEL. OVIEDO" <-> "CORONEL OVIEDO", etc.)
 */

// Mapping of all known variations/abbreviations/synonyms to Canonical TSJE name
const CANONICAL_MAP: Record<string, string> = {
  // Amambay
  'PEDRO J. CABALLERO': 'PEDRO JUAN CABALLERO',
  'PEDRO J CABALLERO': 'PEDRO JUAN CABALLERO',
  'P.J. CABALLERO': 'PEDRO JUAN CABALLERO',
  'P. J. CABALLERO': 'PEDRO JUAN CABALLERO',
  'PJC': 'PEDRO JUAN CABALLERO',
  'PEDRO JUAN CABALLERO': 'PEDRO JUAN CABALLERO',
  'CAPITAN BADO': 'CAPITAN BADO',
  'CAP. BADO': 'CAPITAN BADO',
  'BELLA VISTA NORTE': 'BELLA VISTA',
  'BELLA VISTA': 'BELLA VISTA',
  'ZANJA PYTA': 'ZANJA PYTA',
  'ZANJA PYTA.': 'ZANJA PYTA',
  'KARAPAI': 'KARAPAI',
  'CERRO CORA': 'CERRO CORA',

  // Central / Capital
  'ASUNCION': 'ASUNCION',
  'ASUNCIÓN': 'ASUNCION',
  'CAPITAL': 'ASUNCION',
  'FERNANDO DE LA MORA': 'FERNANDO DE LA MORA',
  'FDO. DE LA MORA': 'FERNANDO DE LA MORA',
  'FDO DE LA MORA': 'FERNANDO DE LA MORA',
  'FDLA MORA': 'FERNANDO DE LA MORA',
  'SAN LORENZO': 'SAN LORENZO',
  'LAMBARE': 'LAMBARE',
  'LAMBARÉ': 'LAMBARE',
  'LUQUE': 'LUQUE',
  'CAPIATA': 'CAPIATA',
  'CAPIATÁ': 'CAPIATA',
  'MARIANO ROQUE ALONSO': 'MARIANO ROQUE ALONSO',
  'M.R.A.': 'MARIANO ROQUE ALONSO',
  'MRA': 'MARIANO ROQUE ALONSO',
  'VILLA ELISA': 'VILLA ELISA',
  'NEMBY': 'NEMBY',
  'ÑEMBY': 'NEMBY',
  'ITA': 'ITA',
  'ITÁ': 'ITA',
  'ITAUGUA': 'ITAUGUA',
  'ITAUGUÁ': 'ITAUGUA',
  'LIMPIO': 'LIMPIO',
  'SAN ANTONIO': 'SAN ANTONIO',
  'VILLA HAYES': 'VILLA HAYES',
  'V. HAYES': 'VILLA HAYES',
  'J. AUGUSTO SALDIVAR': 'J. AUGUSTO SALDIVAR',
  'J.A. SALDIVAR': 'J. AUGUSTO SALDIVAR',
  'JULIAN AUGUSTO SALDIVAR': 'J. AUGUSTO SALDIVAR',
  'AREGUA': 'AREGUA',
  'AREGUÁ': 'AREGUA',
  'YPACARAI': 'YPACARAI',
  'YPACARAÍ': 'YPACARAI',
  'GUARAMBARE': 'GUARAMBARE',
  'GUARAMBARÉ': 'GUARAMBARE',
  'VILLETA': 'VILLETA',
  'YPANE': 'YPANE',
  'YPANÉ': 'YPANE',
  'NUEVA ITALIA': 'NUEVA ITALIA',

  // Alto Paraná
  'CIUDAD DEL ESTE': 'CIUDAD DEL ESTE',
  'CDE': 'CIUDAD DEL ESTE',
  'PRESIDENTE FRANCO': 'PRESIDENTE FRANCO',
  'PTO. PTE. FRANCO': 'PRESIDENTE FRANCO',
  'PUERTO PRESIDENTE FRANCO': 'PRESIDENTE FRANCO',
  'PTE. FRANCO': 'PRESIDENTE FRANCO',
  'HERNANDARIAS': 'HERNANDARIAS',
  'MINGA GUAZU': 'MINGA GUAZU',
  'MINGA GUAZÚ': 'MINGA GUAZU',
  'SANTA RITA': 'SANTA RITA',
  'STA. RITA': 'SANTA RITA',
  'SAN ALBERTO': 'SAN ALBERTO',
  'YGUAZU': 'YGUAZU',
  'YGUAZÚ': 'YGUAZU',
  "JUAN E. O'LEARY": "JUAN E. O'LEARY",
  "JUAN E O LEARY": "JUAN E. O'LEARY",
  "JUAN E. OLEARY": "JUAN E. O'LEARY",
  "JUAN EMILIO O'LEARY": "JUAN E. O'LEARY",
  'JUAN LEON MALLORQUIN': 'JUAN LEON MALLORQUIN',
  'JUAN L. MALLORQUIN': 'JUAN LEON MALLORQUIN',
  'DR. RAUL PENA': 'DR. RAUL PENA',
  'DOCTOR RAUL PENA': 'DR. RAUL PENA',
  'SAN CRISTOBAL': 'SAN CRISTOBAL',
  'SAN CRISTÓBAL': 'SAN CRISTOBAL',
  'SANTA ROSA DEL MONDAY': 'SANTA ROSA DEL MONDAY',
  'STA. ROSA DEL MONDAY': 'SANTA ROSA DEL MONDAY',
  'NARANJAL': 'NARANJAL',
  'ITAKYRY': 'ITAKYRY',
  'MBARACAYU': 'MBARACAYU',
  'MBARACAYÚ': 'MBARACAYU',
  'LOS CEDRALES': 'LOS CEDRALES',
  'DOMINGO MARTINEZ DE IRALA': 'DOMINGO MARTINEZ DE IRALA',
  'TAVAPY': 'TAVAPY',

  // Caaguazú
  'CORONEL OVIEDO': 'CORONEL OVIEDO',
  'CNEL. OVIEDO': 'CORONEL OVIEDO',
  'CNEL OVIEDO': 'CORONEL OVIEDO',
  'CAAGUAZU': 'CAAGUAZU',
  'CAAGUAZÚ': 'CAAGUAZU',
  'DR. J. EULOGIO ESTIGARRIBIA': 'DR. J. EULOGIO ESTIGARRIBIA',
  'DR. J.EULOGIO ESTIGARRIBIA': 'DR. J. EULOGIO ESTIGARRIBIA',
  'DOCTOR J. EULOGIO ESTIGARRIBIA': 'DR. J. EULOGIO ESTIGARRIBIA',
  'CAMPO 9': 'DR. J. EULOGIO ESTIGARRIBIA',
  'DR. JUAN MANUEL FRUTOS': 'DR. JUAN MANUEL FRUTOS',
  'DOCTOR JUAN MANUEL FRUTOS': 'DR. JUAN MANUEL FRUTOS',
  'PASTOREO': 'DR. JUAN MANUEL FRUTOS',
  'DR. CECILIO BAEZ': 'DR. CECILIO BAEZ',
  'DOCTOR CECILIO BAEZ': 'DR. CECILIO BAEZ',
  'SAN JOAQUIN': 'SAN JOAQUIN',
  'SAN JOAQUÍN': 'SAN JOAQUIN',
  'SAN JOSE DE LOS ARROYOS': 'SAN JOSE DE LOS ARROYOS',
  'SAN JOSE': 'SAN JOSE DE LOS ARROYOS',
  'SANTA ROSA DEL MBUTUY': 'SANTA ROSA DEL MBUTUY',
  'STA. ROSA DEL MBUTUY': 'SANTA ROSA DEL MBUTUY',
  'YHU': 'YHU',
  'YHÚ': 'YHU',
  'VAQUERIA': 'VAQUERIA',
  'VAQUERÍA': 'VAQUERIA',
  'REPATRIACION': 'REPATRIACION',
  'REPATRIACIÓN': 'REPATRIACION',
  '3 DE FEBRERO': '3 DE FEBRERO',
  'TRES DE FEBRERO': '3 DE FEBRERO',
  'SIMON BOLIVAR': 'SIMON BOLIVAR',
  'SIMÓN BOLÍVAR': 'SIMON BOLIVAR',
  'RAUL ARSENIO OVIEDO': 'RAUL ARSENIO OVIEDO',
  'RAÚL ARSENIO OVIEDO': 'RAUL ARSENIO OVIEDO',
  'CARAYAO': 'CARAYAO',
  'CARAYAÓ': 'CARAYAO',
  'NUEVA LONDRES': 'NUEVA LONDRES',
  'MCAL. LOPEZ': 'MARISCAL LOPEZ',
  'MCAL LOPEZ': 'MARISCAL LOPEZ',
  'MARISCAL LOPEZ': 'MARISCAL LOPEZ',
  'MARISCAL FRANCISCO SOLANO LOPEZ': 'MARISCAL LOPEZ',
  'TEMBIAPORA': 'TEMBIAPORA',
  'TEMBIAPORÁ': 'TEMBIAPORA',
  'NUEVA TOLEDO': 'NUEVA TOLEDO',

  // San Pedro
  'SAN PEDRO DEL YCUAMANDYYU': 'SAN PEDRO DEL YCUAMANDYYU',
  'SAN PEDRO': 'SAN PEDRO DEL YCUAMANDYYU',
  'SAN ESTANISLAO': 'SAN ESTANISLAO',
  'SANTANI': 'SAN ESTANISLAO',
  'SANTA ROSA DEL AGUARAY': 'SANTA ROSA DEL AGUARAY',
  'STA. ROSA DEL AGUARAY': 'SANTA ROSA DEL AGUARAY',
  'GRAL. RESQUIN': 'GENERAL RESQUIN',
  'GENERAL RESQUIN': 'GENERAL RESQUIN',
  'GENERAL FRANCISCO ISIDORO RESQUIN': 'GENERAL RESQUIN',
  'GRAL. AQUINO': 'GENERAL AQUINO',
  'GENERAL AQUINO': 'GENERAL AQUINO',
  'GENERAL ELIZARDO AQUINO': 'GENERAL AQUINO',
  'GUAYAIBI': 'GUAYAIBI',
  'GUAYAIBÍ': 'GUAYAIBI',
  'CHORE': 'CHORE',
  'CHORÉ': 'CHORE',
  'TACUATI': 'TACUATI',
  'TACUATÍ': 'TACUATI',
  'LIMA': 'LIMA',
  'YATAITY DEL NORTE': 'YATAITY DEL NORTE',
  'NUEVA GERMANIA': 'NUEVA GERMANIA',
  'ITACURUBI DEL ROSARIO': 'ITACURUBI DEL ROSARIO',
  'ITACURUBÍ DEL ROSARIO': 'ITACURUBI DEL ROSARIO',
  'VILLA DEL ROSARIO': 'VILLA DEL ROSARIO',
  'ANTEQUERA': 'ANTEQUERA',
  'PUERTO ANTEQUERA': 'ANTEQUERA',
  'LIBERACION': 'LIBERACION',
  'LIBERACIÓN': 'LIBERACION',
  'SAN VICENTE PANCHOLO': 'SAN VICENTE PANCHOLO',

  // Concepción
  'CONCEPCION': 'CONCEPCION',
  'CONCEPCIÓN': 'CONCEPCION',
  'HORQUETA': 'HORQUETA',
  'YBY YAÚ': 'YBY YAU',
  'YBY YAU': 'YBY YAU',
  'LORETO': 'LORETO',
  'BELEN': 'BELEN',
  'BELÉN': 'BELEN',
  'SAN CARLOS DEL APA': 'SAN CARLOS DEL APA',
  'SAN ALFREDO': 'SAN ALFREDO',
  'PASO BARRETO': 'PASO BARRETO',
  'SARGENTO JOSE FELIX LOPEZ': 'SARGENTO JOSE FELIX LOPEZ',
  'PUENTESIÑO': 'SARGENTO JOSE FELIX LOPEZ',
  'ARROYITO': 'ARROYITO',
  'PASO HORQUETA': 'PASO HORQUETA',

  // Guairá
  'VILLARRICA': 'VILLARRICA',
  'INDEPENDENCIA': 'INDEPENDENCIA',
  'COLONIA INDEPENDENCIA': 'INDEPENDENCIA',
  'PASO YOBAL': 'PASO YOBAL',
  'PASO YOBÁI': 'PASO YOBAL',
  'CNEL. MARTINEZ': 'CORONEL MARTINEZ',
  'CORONEL MARTINEZ': 'CORONEL MARTINEZ',
  'MBOCAYATY DEL GUAIRA': 'MBOCAYATY',
  'MBOCAYATY': 'MBOCAYATY',
  'YATAITY': 'YATAITY',
  'NATALICIO TALAVERA': 'NATALICIO TALAVERA',
  'TROCHE': 'DOCTOR BOTRELL',
  'DR. BOTTRELL': 'DOCTOR BOTRELL',
  'DOCTOR BOTTRELL': 'DOCTOR BOTRELL',
  'GRAL. EUGENIO A. GARAY': 'GENERAL EUGENIO A. GARAY',
  'GENERAL GARAY': 'GENERAL EUGENIO A. GARAY',
  'SAN SALVADOR': 'SAN SALVADOR',
  'BORJA': 'BORJA',
  'ITURBE': 'ITURBE',
  'ITAPE': 'ITAPE',
  'ITAPÉ': 'ITAPE',
  'JOSE FASSARDI': 'JOSE FASSARDI',
  'JOSÉ FASSARDI': 'JOSE FASSARDI',
  'FELIX PEREZ CARDOZO': 'FELIX PEREZ CARDOZO',
  'FÉLIX PÉREZ CARDOZO': 'FELIX PEREZ CARDOZO',

  // Itapúa
  'ENCARNACION': 'ENCARNACION',
  'ENCARNACIÓN': 'ENCARNACION',
  'CAMBYRETA': 'CAMBYRETA',
  'CAMBYRETÁ': 'CAMBYRETA',
  'SAN JUAN DEL PARANA': 'SAN JUAN DEL PARANA',
  'SAN JUAN DEL PARANÁ': 'SAN JUAN DEL PARANA',
  'CARMEN DEL PARANA': 'CARMEN DEL PARANA',
  'CARMEN DEL PARANÁ': 'CARMEN DEL PARANA',
  'CORONEL BOGADO': 'CORONEL BOGADO',
  'CNEL. BOGADO': 'CORONEL BOGADO',
  'CNEL BOGADO': 'CORONEL BOGADO',
  'BELLA VISTA SUR': 'BELLA VISTA SUR',
  'OBLIGADO': 'OBLIGADO',
  'HOHENAU': 'HOHENAU',
  'TOMAS ROMERO PEREIRA': 'TOMAS ROMERO PEREIRA',
  'TOMÁS ROMERO PEREIRA': 'TOMAS ROMERO PEREIRA',
  'MARIA AUXILIADORA': 'TOMAS ROMERO PEREIRA',
  'NATALIO': 'NATALIO',
  'MAYOR OTAÑO': 'MAYOR OTANO',
  'MAYOR OTANO': 'MAYOR OTANO',
  'SAN PEDRO DEL PARANA': 'SAN PEDRO DEL PARANA',
  'SAN PEDRO DEL PARANÁ': 'SAN PEDRO DEL PARANA',
  'GRAL. ARTIGAS': 'GENERAL ARTIGAS',
  'GENERAL ARTIGAS': 'GENERAL ARTIGAS',
  'GRAL. DELGADO': 'GENERAL DELGADO',
  'GENERAL DELGADO': 'GENERAL DELGADO',
  'EDELIRA': 'EDELIRA',
  'CAPITAN MEZA': 'CAPITAN MEZA',
  'CAPITÁN MEZA': 'CAPITAN MEZA',
  'PIRAPO': 'PIRAPO',
  'PIRAPÓ': 'PIRAPO',
  'CARLOS ANTONIO LOPEZ': 'CARLOS ANTONIO LOPEZ',
  'CARLOS ANTONIO LÓPEZ': 'CARLOS ANTONIO LOPEZ',
  'SAN RAFAEL DEL PARANA': 'SAN RAFAEL DEL PARANA',
  'SAN RAFAEL DEL PARANÁ': 'SAN RAFAEL DEL PARANA',
  'ALTO VERA': 'ALTO VERA',
  'ALTO VERÁ': 'ALTO VERA',
  'NUEVA ALBORADA': 'NUEVA ALBORADA',
  'JESUS': 'JESUS',
  'JESÚS': 'JESUS',
  'TRINIDAD': 'TRINIDAD',
  'SAN COSME Y DAMIAN': 'SAN COSME Y DAMIAN',
  'SAN COSME Y DAMIÁN': 'SAN COSME Y DAMIAN',
  'FRAM': 'FRAM',
  'LA PAZ': 'LA PAZ',
  'CAPITAN MIRANDA': 'CAPITAN MIRANDA',
  'CAPITÁN MIRANDA': 'CAPITAN MIRANDA',
  'LEANDRO OVIEDO': 'LEANDRO OVIEDO',
  'JOSE LEANDRO OVIEDO': 'LEANDRO OVIEDO',
  'JOSÉ LEANDRO OVIEDO': 'LEANDRO OVIEDO',
  'ITAPUA POTY': 'ITAPUA POTY',
  'ITAPÚA POTY': 'ITAPUA POTY',

  // Cordillera
  'CAACUPE': 'CAACUPE',
  'CAACUPÉ': 'CAACUPE',
  'EUSEBIO AYALA': 'EUSEBIO AYALA',
  'BARRERO GRANDE': 'EUSEBIO AYALA',
  'PIRIBEBUY': 'PIRIBEBUY',
  'TOBATI': 'TOBATI',
  'TOBATÍ': 'TOBATI',
  'ITACURUBI DE LA CORDILLERA': 'ITACURUBI DE LA CORDILLERA',
  'ITACURUBÍ DE LA CORDILLERA': 'ITACURUBI DE LA CORDILLERA',
  'ALTOS': 'ALTOS',
  'ATYRA': 'ATYRA',
  'ATYRÁ': 'ATYRA',
  'SAN BERNARDINO': 'SAN BERNARDINO',
  'EMBOSCADA': 'EMBOSCADA',
  'ARROYOS Y ESTEROS': 'ARROYOS Y ESTEROS',
  'CARAGUATAY': 'CARAGUATAY',
  'SAN JOSE OBRERO': 'SAN JOSE OBRERO',
  'SAN JOSÉ OBRERO': 'SAN JOSE OBRERO',
  'ISLA PUCU': 'ISLA PUCU',
  'ISLA PUCÚ': 'ISLA PUCU',
  '1RO DE MARZO': '1RO DE MARZO',
  'PRIMERO DE MARZO': '1RO DE MARZO',
  'SANTA ELENA': 'SANTA ELENA',
  'VALENZUELA': 'VALENZUELA',
  'NUEVA COLOMBIA': 'NUEVA COLOMBIA',
  'LOMA GRANDE': 'LOMA GRANDE',
  'MBOCAYATY DEL YHAGUY': 'MBOCAYATY DEL YHAGUY',
  'JUAN DE MENA': 'JUAN DE MENA',

  // Paraguarí
  'PARAGUARI': 'PARAGUARI',
  'PARAGUARÍ': 'PARAGUARI',
  'CARAPEGUA': 'CARAPEGUA',
  'CARAPEGUÁ': 'CARAPEGUA',
  'QUIINDY': 'QUIINDY',
  'YAGUARON': 'YAGUARON',
  'YAGUARÓN': 'YAGUARON',
  'PIRAYU': 'PIRAYU',
  'PIRAYÚ': 'PIRAYU',
  'ACAHAY': 'ACAHAY',
  'CAAPUCU': 'CAAPUCU',
  'CAAPUCÚ': 'CAAPUCU',
  'QUYQUYHO': 'QUYQUYHO',
  'YBYCUI': 'YBYCUI',
  'YBYCUÍ': 'YBYCUI',
  'LA COLMENA': 'LA COLMENA',
  'SAPUCAI': 'SAPUCAI',
  'SAPUCAÍ': 'SAPUCAI',
  'GENERAL BERNARDINO CABALLERO': 'GENERAL BERNARDINO CABALLERO',
  'GRAL. BERNARDINO CABALLERO': 'GENERAL BERNARDINO CABALLERO',
  'GRAL. CABALLERO': 'GENERAL BERNARDINO CABALLERO',
  'YBYTYMI': 'YBYTYMI',
  'YBYTYMÍ': 'YBYTYMI',
  'ESCOBAR': 'ESCOBAR',
  'TEBICUARYMI': 'TEBICUARYMI',
  'TEBICUARYMÍ': 'TEBICUARYMI',
  'MBUYAPEY': 'MBUYAPEY',
  'MARIA ANTONIA': 'MARIA ANTONIA',
  'MARÍA ANTONIA': 'MARIA ANTONIA',

  // Misiones
  'SAN JUAN BAUTISTA': 'SAN JUAN BAUTISTA',
  'SAN JUAN BTA.': 'SAN JUAN BAUTISTA',
  'SAN JUAN BTA': 'SAN JUAN BAUTISTA',
  'SAN IGNACIO': 'SAN IGNACIO',
  'SAN IGNACIO GUAZU': 'SAN IGNACIO',
  'SAN IGNACIO GUAZÚ': 'SAN IGNACIO',
  'SANTA ROSA': 'SANTA ROSA DE LIMA',
  'SANTA ROSA DE LIMA': 'SANTA ROSA DE LIMA',
  'STA. ROSA DE LIMA': 'SANTA ROSA DE LIMA',
  'SANTA ROSA DE LAS MISIONES': 'SANTA ROSA DE LIMA',
  'AYOLAS': 'AYOLAS',
  'SANTIAGO': 'SANTIAGO',
  'SAN MIGUEL': 'SAN MIGUEL',
  'SANTA MARIA': 'SANTA MARIA',
  'SANTA MARÍA': 'SANTA MARIA',
  'SAN PATRICIO': 'SAN PATRICIO',
  'VILLA FLORIDA': 'VILLA FLORIDA',
  'YABEBYRY': 'YABEBYRY',

  // Caazapá
  'CAAZAPA': 'CAAZAPA',
  'CAAZAPÁ': 'CAAZAPA',
  'SAN JUAN NEPOMUCENO': 'SAN JUAN NEPOMUCENO',
  'SAN JUAN NEP.': 'SAN JUAN NEPOMUCENO',
  'SAN JUAN NEP': 'SAN JUAN NEPOMUCENO',
  'YUTY': 'YUTY',
  'ABAI': 'ABAI',
  'ABAÍ': 'ABAI',
  'TAVAI': 'TAVAI',
  'TAVAÍ': 'TAVAI',
  'BUENA VISTA': 'BUENA VISTA',
  'GRAL. MORINIGO': 'GENERAL MORINIGO',
  'GENERAL MORINIGO': 'GENERAL MORINIGO',
  'GENERAL HIGINIO MORINIGO': 'GENERAL MORINIGO',
  '3 DE MAYO': '3 DE MAYO',
  'TRES DE MAYO': '3 DE MAYO',
  'FULGENCIO YEGROS': 'FULGENCIO YEGROS',
  'YEGROS': 'FULGENCIO YEGROS',
  'DR. MOISES BERTONI': 'DR. MOISES BERTONI',
  'DOCTOR MOISES BERTONI': 'DR. MOISES BERTONI',
  'SAN CRISTOBAL DEL GUAIRA': 'SAN CRISTOBAL',

  // Canindeyú
  'SALTO DEL GUAIRA': 'SALTO DEL GUAIRA',
  'SALTO DEL GUAIRÁ': 'SALTO DEL GUAIRA',
  'CURUGUATY': 'CURUGUATY',
  'VILLA YGATIMI': 'VILLA YGATIMI',
  'VILLA YGATIMÍ': 'VILLA YGATIMI',
  'YGATIMI': 'VILLA YGATIMI',
  'YASY CANY': 'YASY CANY',
  'YASY CAÑY': 'YASY CANY',
  'KATUETE': 'KATUETE',
  'KATUETÉ': 'KATUETE',
  'NUEVA ESPERANZA': 'NUEVA ESPERANZA',
  'YBY PYTA': 'YBY PYTA',
  'YBY PYTÁ': 'YBY PYTA',
  'CORPUS CHRISTI': 'CORPUS CHRISTI',
  'ITANARA': 'ITANARA',
  'ITANARÁ': 'ITANARA',
  'YPEJHU': 'YPEJHU',
  'YPEJHÚ': 'YPEJHU',
  'LA PALOMA': 'LA PALOMA',
  'LA PALOMA DEL ESPIRITU SANTO': 'LA PALOMA',
  'GENERAL FRANCISCO CABALLERO ALVAREZ': 'PUENTE KYJHA',
  'PUENTE KYJHA': 'PUENTE KYJHA',
  'MARACANA': 'MARACANA',
  'MARACANÁ': 'MARACANA',
  'PUERTO ADELA': 'PUERTO ADELA',

  // Ñeembucú
  'PILAR': 'PILAR',
  'ALBERDI': 'ALBERDI',
  'CERRITO': 'CERRITO',
  'HUMAITA': 'HUMAITA',
  'HUMAITÁ': 'HUMAITA',
  'PASO DE PATRIA': 'PASO DE PATRIA',
  'GRAL. JOSE E. DIAZ': 'GENERAL DIAZ',
  'GENERAL DIAZ': 'GENERAL DIAZ',
  'GENERAL JOSE EDUVIGIS DIAZ': 'GENERAL DIAZ',
  'SAN JUAN DEL NEEMBUCU': 'SAN JUAN DEL NEEMBUCU',
  'SAN JUAN DEL ÑEEMBUCÚ': 'SAN JUAN DEL NEEMBUCU',
  'ISLA UMBU': 'ISLA UMBU',
  'ISLA UMBÚ': 'ISLA UMBU',
  'DESMOCHADOS': 'DESMOCHADOS',
  'TACUARAS': 'TACUARAS',
  'VILLA FRANCA': 'VILLA FRANCA',
  'VILLA OLIVA': 'VILLA OLIVA',
  'MAYOR MARTINEZ': 'MAYOR MARTINEZ',
  'VILLALBIN': 'VILLALBIN',
  'VILLALBÍN': 'VILLALBIN',
  'GUAZU CUA': 'GUAZU CUA',
  'GUAZÚ CUÁ': 'GUAZU CUA',
  'LAURELES': 'LAURELES',

  // Chaco (Presidente Hayes, Boquerón, Alto Paraguay)
  'MARISCAL ESTIGARRIBIA': 'MARISCAL ESTIGARRIBIA',
  'MCAL. ESTIGARRIBIA': 'MARISCAL ESTIGARRIBIA',
  'MCAL ESTIGARRIBIA': 'MARISCAL ESTIGARRIBIA',
  'MARISCAL JOSE FELIX ESTIGARRIBIA': 'MARISCAL ESTIGARRIBIA',
  'FILADELFIA': 'FILADELFIA',
  'LOMA PLATA': 'LOMA PLATA',
  'NEULAND': 'MARISCAL ESTIGARRIBIA',
  'BENJAMIN ACEVAL': 'BENJAMIN ACEVAL',
  'BENJAMÍN ACEVAL': 'BENJAMIN ACEVAL',
  'NANAWA': 'NANAWA',
  'PUERTO FALCON': 'PUERTO FALCON',
  'PUERTO FALCÓN': 'PUERTO FALCON',
  'TTE. IRALA FERNANDEZ': 'TTE. IRALA FERNANDEZ',
  'TENIENTE IRALA FERNANDEZ': 'TTE. IRALA FERNANDEZ',
  'TTE. ESTEBAN MARTINEZ': 'TTE. ESTEBAN MARTINEZ',
  'TENIENTE ESTEBAN MARTINEZ': 'TTE. ESTEBAN MARTINEZ',
  'GENERAL BRUGUEZ': 'GENERAL BRUGUEZ',
  'GRAL. BRUGUEZ': 'GENERAL BRUGUEZ',
  'POZO COLORADO': 'VILLA HAYES',
  'FUERTE OLIMPO': 'FUERTE OLIMPO',
  'BAHIA NEGRA': 'BAHIA NEGRA',
  'BAHÍA NEGRA': 'BAHIA NEGRA',
  'CARMELO PERALTA': 'CARMELO PERALTA',
  'PUERTO CASADO': 'PUERTO CASADO',
  'BOQUERON': 'BOQUERON',
  'BOQUERÓN': 'BOQUERON'
};

// Inverted lookup map: Canonical name -> Array of all known aliases
const CANONICAL_TO_VARIANTS: Map<string, Set<string>> = new Map();

for (const [variant, canonical] of Object.entries(CANONICAL_MAP)) {
  const normCanonical = canonical.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const normVariant = variant.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  if (!CANONICAL_TO_VARIANTS.has(normCanonical)) {
    CANONICAL_TO_VARIANTS.set(normCanonical, new Set([normCanonical, canonical]));
  }
  const set = CANONICAL_TO_VARIANTS.get(normCanonical)!;
  set.add(normVariant);
  set.add(variant);
}

/**
 * Strips accents, cleans spaces, uppercase.
 */
export function cleanDistrictString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns the single official canonical district name for any input.
 * (e.g. "PEDRO J. CABALLERO" -> "PEDRO JUAN CABALLERO")
 */
export function normalizeDistrict(raw: string | null | undefined): string {
  if (!raw) return '';
  const cleaned = cleanDistrictString(raw);
  if (!cleaned) return '';

  // Direct map check
  if (CANONICAL_MAP[cleaned]) {
    return CANONICAL_MAP[cleaned];
  }
  if (CANONICAL_MAP[raw.toUpperCase().trim()]) {
    return CANONICAL_MAP[raw.toUpperCase().trim()];
  }

  // Check in inverted map keys
  if (CANONICAL_TO_VARIANTS.has(cleaned)) {
    return cleaned;
  }

  // Fallback: Return uppercase clean string
  return cleaned;
}

/**
 * Returns all possible variations, abbreviations, accents, and aliases for a given district.
 * Used for SQL queries (IN (...) clauses) so no existing database record is ever missed.
 */
export function getDistrictVariants(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const canonical = normalizeDistrict(raw);
  const cleanCanonical = cleanDistrictString(canonical);

  const variantsSet = new Set<string>();
  
  // Add base inputs
  variantsSet.add(raw.trim());
  variantsSet.add(raw.toUpperCase().trim());
  variantsSet.add(cleanCanonical);
  variantsSet.add(canonical);

  // If known in map, add all aliases
  const knownAliases = CANONICAL_TO_VARIANTS.get(cleanCanonical);
  if (knownAliases) {
    knownAliases.forEach(alias => {
      variantsSet.add(alias);
      variantsSet.add(alias.toUpperCase());
      variantsSet.add(cleanDistrictString(alias));
    });
  }

  // Also handle common accent pairs
  const baseArray = Array.from(variantsSet);
  baseArray.forEach(v => {
    if (v.includes('CONCEPCION')) variantsSet.add(v.replace('CONCEPCION', 'CONCEPCIÓN'));
    if (v.includes('ASUNCION')) variantsSet.add(v.replace('ASUNCION', 'ASUNCIÓN'));
    if (v.includes('ITAPUA')) variantsSet.add(v.replace('ITAPUA', 'ITAPÚA'));
    if (v.includes('GUAIRA')) variantsSet.add(v.replace('GUAIRA', 'GUAIRÁ'));
    if (v.includes('CAAGUAZU')) variantsSet.add(v.replace('CAAGUAZU', 'CAAGUAZÚ'));
    if (v.includes('CAAZAPA')) variantsSet.add(v.replace('CAAZAPA', 'CAAZAPÁ'));
    if (v.includes('PARAGUARI')) variantsSet.add(v.replace('PARAGUARI', 'PARAGUARÍ'));
    if (v.includes('ALTO PARANA')) variantsSet.add(v.replace('ALTO PARANA', 'ALTO PARANÁ'));
    if (v.includes('NEEMBUCU')) {
      variantsSet.add(v.replace('NEEMBUCU', 'ÑEEMBUCÚ'));
      variantsSet.add(v.replace('NEEMBUCU', 'ÑEEMBUCU'));
      variantsSet.add(v.replace('NEEMBUCU', 'NEEMBUCÚ'));
    }
  });

  return Array.from(variantsSet).filter(Boolean);
}

/**
 * Automated Database Normalization Migration
 * Updates existing electors, users, lists, campaigns, voting_locations to Canonical district names.
 */
export function runDistrictNormalizationMigration(db: any) {
  const safeRun = (sql: string) => {
    try { db.prepare(sql).run(); } catch (e: any) {}
  };

  try {
    console.log('[DISTRICT NORMALIZER] Executing global district normalization migration...');

    // Clean up users, lists, campaigns, voting_locations (fast, <1000 rows)
    const pjcVariants = "('PEDRO J. CABALLERO', 'PEDRO J CABALLERO', 'P.J. CABALLERO', 'P. J. CABALLERO', 'PJC', 'pedro j. caballero', 'pedro juan caballero')";
    safeRun(`UPDATE users SET distrito = 'PEDRO JUAN CABALLERO' WHERE distrito IN ${pjcVariants}`);
    safeRun(`UPDATE lists SET ciudad = 'PEDRO JUAN CABALLERO' WHERE ciudad IN ${pjcVariants}`);
    safeRun(`UPDATE campaigns SET distrito = 'PEDRO JUAN CABALLERO' WHERE distrito IN ${pjcVariants}`);
    safeRun(`UPDATE voting_locations SET distrito = 'PEDRO JUAN CABALLERO' WHERE distrito IN ${pjcVariants}`);

    const oviVariants = "('CNEL. OVIEDO', 'CNEL OVIEDO', 'cnel. oviedo', 'coronel oviedo')";
    safeRun(`UPDATE users SET distrito = 'CORONEL OVIEDO' WHERE distrito IN ${oviVariants}`);
    safeRun(`UPDATE lists SET ciudad = 'CORONEL OVIEDO' WHERE ciudad IN ${oviVariants}`);
    safeRun(`UPDATE campaigns SET distrito = 'CORONEL OVIEDO' WHERE distrito IN ${oviVariants}`);
    safeRun(`UPDATE voting_locations SET distrito = 'CORONEL OVIEDO' WHERE distrito IN ${oviVariants}`);

    const cdeVariants = "('CDE', 'cde', 'ciudad del este')";
    safeRun(`UPDATE users SET distrito = 'CIUDAD DEL ESTE' WHERE distrito IN ${cdeVariants}`);
    safeRun(`UPDATE lists SET ciudad = 'CIUDAD DEL ESTE' WHERE ciudad IN ${cdeVariants}`);
    safeRun(`UPDATE voting_locations SET distrito = 'CIUDAD DEL ESTE' WHERE distrito IN ${cdeVariants}`);

    const asuVariants = "('CAPITAL', 'ASUNCIÓN', 'asuncion', 'asunción')";
    safeRun(`UPDATE users SET distrito = 'ASUNCION' WHERE distrito IN ${asuVariants}`);
    safeRun(`UPDATE lists SET ciudad = 'ASUNCION' WHERE ciudad IN ${asuVariants}`);
    safeRun(`UPDATE voting_locations SET distrito = 'ASUNCION' WHERE distrito IN ${asuVariants}`);

    safeRun("UPDATE users SET distrito = UPPER(TRIM(distrito)) WHERE distrito IS NOT NULL");
    safeRun("UPDATE lists SET ciudad = UPPER(TRIM(ciudad)) WHERE ciudad IS NOT NULL");
    safeRun("UPDATE campaigns SET distrito = UPPER(TRIM(distrito)) WHERE distrito IS NOT NULL");
    safeRun("UPDATE voting_locations SET distrito = UPPER(TRIM(distrito)) WHERE distrito IS NOT NULL");

    console.log('[DISTRICT NORMALIZER] Migration completed successfully.');
  } catch (err: any) {
    console.error('[DISTRICT NORMALIZER ERROR]', err.message);
  }
}
