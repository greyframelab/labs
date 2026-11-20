# Construye semilla/sentido.txt: para ~40.000 palabras del español, 8 ejes de significado (0–15) y su arquetipo más cercano.
# Vectores: spaCy es_core_news_lg (GitHub). Frecuencias: wordfreq. Ejes por proyección sobre palabras semilla (SemAxis).
import glob, re, unicodedata, numpy as np, spacy
from wordfreq import top_n_list
nlp = spacy.load(glob.glob('es_core_news_lg/es_core_news_lg-*')[0], exclude=['tok2vec','morphologizer','parser','senter','attribute_ruler','lemmatizer','ner'])
V = nlp.vocab
def vec(w):
    lx = V[w]
    if not lx.has_vector: return None
    v = lx.vector; n = np.linalg.norm(v); return v / n if n > 0 else None
def norm(s): return re.sub(r'[^a-zñ]', '', unicodedata.normalize('NFD', s.lower().replace('ñ', '\0')).encode('ascii', 'ignore').decode().replace('\0', 'ñ')) if False else re.sub(r'[̀-ͯ]', '', unicodedata.normalize('NFD', s.lower()))
AX = [
 ('valencia', 'amor alegría felicidad paz belleza esperanza bueno ternura risa éxito libertad sonrisa placer amigo regalo', 'odio tristeza dolor muerte miedo guerra malo asco sufrimiento fracaso crueldad culpa enfermedad soledad angustia'),
 ('activacion', 'explosión furia grito correr pánico excitación frenético tormenta violencia urgente velocidad choque éxtasis rabia fiesta', 'calma sueño quietud descanso silencio lento sereno dormir tranquilo reposo meditación suave pausa siesta aburrido'),
 ('calor', 'fuego calor sol ardiente quemar verano lava hoguera desierto sudor llama horno tropical brasa incendio', 'hielo frío nieve invierno helado glaciar escarcha congelar polar gélido ártico nevera granizo invernal témpano'),
 ('luz', 'luz sol brillo claro día amanecer resplandor blanco estrella iluminar radiante dorado destello lámpara mediodía', 'oscuridad noche sombra negro tinieblas oscuro penumbra eclipse abismo cueva medianoche tenebroso apagón ciego niebla'),
 ('maquina', 'máquina motor robot ordenador metal engranaje algoritmo código circuito fábrica cable chip digital tornillo pantalla', 'árbol flor piel cuerpo sangre raíz hoja animal corazón semilla carne bosque respirar nacer musgo'),
 ('dureza', 'piedra roca acero hierro diamante duro cuchillo hueso granito golpe muro filo cemento martillo cristal', 'algodón almohada seda suave nube espuma terciopelo pluma blando lana gelatina crema caricia esponja pétalo'),
 ('peso', 'montaña plomo ancla peso elefante pesado tonelada roca edificio catedral gigante tierra hundir masivo yunque', 'pluma aire burbuja ligero polvo mariposa vuelo flotar brisa humo chispa hilo globo susurro leve'),
 ('abstraccion', 'libertad justicia idea verdad alma destino infinito concepto razón esperanza memoria tiempo existencia belleza sentido', 'mesa silla piedra perro coche casa zapato cuchara botella puerta ventana martillo libro taza lápiz'),
]
FAM = {
 'agua': 'agua mar lluvia llover río ola océano lago llorar lágrima nieve hielo niebla marea playa rocío nube sudor',
 'fuego': 'fuego llama sol calor rabia ira furia sangre guerra quemar volcán rojo pasión infierno arder brasa incendio odio lucha',
 'amor': 'amor beso corazón abrazo deseo cariño ternura piel madre padre hijo hija querer amar amiga amigo familia dulce caricia',
 'miedo': 'miedo sombra noche oscuridad oscuro muerte morir terror soledad vacío angustia pesadilla fantasma perdido dolor ausencia herida',
 'luz': 'luz día oro alba amanecer estrella brillo esperanza cielo luna blanco despertar mirar ojo ver claro',
 'tiempo': 'tiempo memoria recuerdo reloj pasado futuro olvido historia ayer mañana siempre nunca viejo infancia espera',
 'maquina': 'máquina código robot datos red ciudad metal ordenador inteligencia algoritmo pantalla tecnología sistema motor cable digital',
 'calma': 'calma paz silencio respirar sueño dormir quietud nada descanso suave lento meditar flotar',
 'caos': 'caos ruido grito explosión locura fiesta baile tormenta rompe romper choque velocidad prisa nervios estrés',
 'vida': 'vida semilla nacer flor árbol tierra verde bosque cuerpo crecer raíz hoja jardín animal planta respirar',
}
FKEYS = list(FAM)
def centroid(ws):
    vs = [vec(w) for w in ws.split() if vec(w) is not None]; c = np.mean(vs, 0); return c / np.linalg.norm(c)
axes = [(n, centroid(p), centroid(q)) for n, p, q in AX]
FV = [np.stack([vec(w) for w in FAM[k].split() if vec(w) is not None]) for k in FKEYS]
STOP = set('el la los las lo un una unos unas y e o u de del a al en con por para que es eso esto esta este mi tu su sus me te se le les nos hola vale bueno pues ya si no muy mas como yo ella ellos hay ahi aqui algo eh ah oh vamos mira oye pero sin sobre entre hasta desde cuando donde porque gracias adios'.split())
words, M, seen = [], [], set()
for w in top_n_list('es', 90000):
    if not re.fullmatch(r'[a-záéíóúüñ]{3,}', w): continue
    k = norm(w)
    if k in seen or k in STOP: continue
    v = vec(w)
    if v is None: continue
    seen.add(k); words.append(k); M.append(v)
    if len(words) >= 40000: break
M = np.stack(M)
S = np.stack([M @ p - M @ q for _, p, q in axes], 1)
Z = (S - np.median(S, 0)) / (S.std(0) + 1e-9)               # neutro = 8; solo lo que destaca se aleja del centro
Q = np.clip(np.round(8 + Z * 2.6), 0, 15).astype(int)
F = np.stack([np.sort(M @ fv.T, 1)[:, -3:].mean(1) for fv in FV], 1)   # parecido medio a las 3 palabras más cercanas de cada arquetipo
top = np.argsort(-F, 1)
best, second = F[np.arange(len(F)), top[:, 0]], F[np.arange(len(F)), top[:, 1]]
strength = np.clip(((best - 0.3) / 0.35 * 16 * np.clip((best - second) / 0.04, 0, 1)).astype(int), 0, 15)
HX = '0123456789abcdef'
with open('sentido.txt', 'w') as f:
    f.write('# VØID_LOOM · SEMILLA — sentido de 40.000 palabras: ejes ' + ' '.join(a[0] for a in AX) + ' (0-f) · arquetipo (0-9: ' + ' '.join(FKEYS) + ') · fuerza (0-f)\n')
    for i, w in enumerate(words):
        f.write(w + ' ' + ''.join(HX[x] for x in Q[i]) + HX[top[i, 0]] + HX[strength[i]] + '\n')
import collections
for t in ['hoguera','lágrima','abrazo','democracia','mesa','volcán','silencio','ordenador','tormenta','ternura','cuchillo','barcelona','museo','pájaro','cemento']:
    k = norm(t)
    if k in seen:
        i = words.index(k); print(t, dict(zip([a[0][:4] for a in AX], Q[i])), FKEYS[top[i,0]], strength[i])
