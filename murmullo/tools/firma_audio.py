# Sonido de la firma de VØID_LOOM para el Reel de MURMULLO (en el mundo de NADIR: grave, limpio, sin ruido blanco)
import numpy as np, wave, sys
SR=48000; D=5.5; n=int(SR*D); t=np.arange(n)/SR; L=np.zeros(n); R=np.zeros(n)
rng=np.random.default_rng(7)
def env(t0,a,d,shape=1.0):
    e=np.zeros(n); i0=int(t0*SR); ia=max(1,int(a*SR)); x=np.arange(n-i0)/SR
    seg=np.where(x<a, x/a, np.exp(-(x-a)/d))**shape; e[i0:]=seg; return e
def add(sig,pan=0.):
    global L,R; L+=sig*np.sqrt((1-pan)/2); R+=sig*np.sqrt((1+pan)/2)
# 1 · los siete hilos caen: tonos graves que se deslizan hacia abajo, escalonados
for k in range(7):
    t0=0.02+k*0.06; f0=180+k*14; f1=f0*0.72
    ph=2*np.pi*np.cumsum(np.where(t>=t0, f0+(f1-f0)*np.clip((t-t0)/0.7,0,1), 0))/SR
    add(np.sin(ph)*env(t0,0.05,0.35)*0.045,(k-3)/4)
# 2 · el vacío se abre (0,75 s): sub que cae + metal grave FM, corto
ph=2*np.pi*np.cumsum(np.where(t>=.75, 56*np.exp(-np.clip(t-.75,0,None)*1.2)+26, 0))/SR
add(np.sin(ph)*env(.75,.008,.55)*0.75)
m=np.sin(2*np.pi*92*t+ 3.5*np.exp(-np.clip(t-.75,0,None)*18)*np.sin(2*np.pi*130*t))
add(m*env(.75,.004,.22)*0.16)
# 3 · el hilo de color (1,05 s): un tono que sube una octava y queda vibrando bajo
f=np.where(t<1.05,147, 147*2**np.clip((t-1.05)/.28,0,1)); ph=2*np.pi*np.cumsum(f)/SR
vib=1+0.004*np.sin(2*np.pi*4.6*t)*np.clip((t-1.6),0,1)
w=(np.sin(ph*vib)+0.35*np.sin(2*ph*vib)+0.12*np.sin(3*ph*vib))*env(1.05,.25,1.6)*np.clip((4.9-t)/0.6,0,1)*0.10
add(w,0.15); add(w*0.8,-0.15)
# 4 · descifrado (1,5–2,6 s): tics de madera hueca, graves y suaves
for k in range(22):
    tk=1.5+rng.random()*1.1; f=480+rng.random()*160
    add(np.sign(np.sin(2*np.pi*f*t))*0.4*np.sin(2*np.pi*f*t)*env(tk,.0015,.012)*0.05, rng.uniform(-.6,.6))
# 5 · lema y créditos: dos golpes sordos lejanos
for tk in (2.6,3.0): add(np.sin(2*np.pi*70*t)*env(tk,.004,.12)*0.18)
# 6 · cola: el dron en Re se apaga con la firma
dr=(np.sin(2*np.pi*73.42*t)+0.5*np.sin(2*np.pi*36.71*t)+0.15*np.sin(2*np.pi*110.0*t))*np.clip(t/1.0,0,1)*np.clip((5.5-t)/1.2,0,1)*0.07
add(dr)
# sala oscura corta (convolución con cola exponencial filtrada), sin delay
ir_n=int(SR*2.2); ir=rng.standard_normal(ir_n)*np.exp(-np.arange(ir_n)/SR*2.6)
k=np.exp(-2*np.pi*1400/SR); y=0; irf=np.empty_like(ir)
for i in range(ir_n): y=y*k+ir[i]*(1-k); irf[i]=y
irf/=np.abs(irf).sum()/6
def wet(x): return np.convolve(x,irf)[:n]
L2=L+0.35*wet(L); R2=R+0.35*wet(R)
st=np.stack([L2,R2],1); st/=max(1e-9,np.abs(st).max())/0.7
with wave.open(sys.argv[1],'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st*32767).astype('<i2').tobytes())
print('firma ok')
