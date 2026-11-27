# Sonido de la firma de VØID_LOOM para MENSAJERO: sigue en el mundo de la pieza (dark ambient, NADIR / 2049).
# Ni campanas ni tonos que suben: la señal llega desde lejos, el vacío se abre con un BRAAM grave,
# el hilo es el mismo "arco" metálico que revela la antena, el descifrado son paquetes de datos sordos
# y todo se apaga en el dron en Re. Uso: python3 firma_audio.py salida.wav
import numpy as np, wave, sys
from scipy.signal import lfilter, butter, sosfilt
SR=48000; D=5.5; n=int(SR*D); t=np.arange(n)/SR; L=np.zeros(n); R=np.zeros(n); rng=np.random.default_rng(11)
def env(t0,a,d):
    e=np.zeros(n); i0=int(t0*SR); x=np.arange(n-i0)/SR; e[i0:]=np.where(x<a,(x/a)**2,np.exp(-(x-a)/d)); return e
def add(s,pan=0.): global L,R; L+=s*np.sqrt((1-pan)/2); R+=s*np.sqrt((1+pan)/2)
from scipy.signal import sosfilt_zi
def lp(x,fc,o=2):
    if np.ndim(fc)==0: return sosfilt(butter(o,fc,'low',fs=SR,output='sos'),x)
    # filtro que se mueve: por bloques de 256 muestras, conservando el estado
    y=np.empty_like(x); zi=None; B=256
    for i in range(0,n,B):
        sos=butter(o,float(np.clip(fc[i],20,SR/2.2)),'low',fs=SR,output='sos')
        if zi is None: zi=np.zeros((sos.shape[0],2))
        y[i:i+B],zi=sosfilt(sos,x[i:i+B],zi=zi)
    return y
def saw(f,ph0=0.): ph=np.cumsum(np.broadcast_to(f,(n,)))/SR+ph0; return 2*(ph%1)-1
fade=np.clip((5.5-t)/1.3,0,1)
# 1 · la señal llega (0–0,75): cluster grave de sierras desafinadas que crece, filtro que se abre
sw=sum(saw(73.42*(1+d),rng.random()) for d in (-.006,-.002,.003,.007))/4
cut=lp(sw,120+520*np.clip(t/.75,0,1)**2,4)*np.clip(t/.75,0,1)**2.2*np.where(t<.78,1,np.exp(-(t-.78)/.05))
add(cut*.30)
# 2 · el vacío se abre (0,75): BRAAM — sierras en Re1/Re2/La2 con filtro que cae + sub que cae
br=(saw(36.71)+saw(36.71*1.004,.3)+.8*saw(73.42*0.997,.6)+.5*saw(110.0,.1))/3.3
e2=env(.75,.02,1.1); add(lp(br,90+900*np.exp(-np.clip(t-.75,0,None)*3.2),4)*e2*.55)
sub=np.sin(2*np.pi*np.cumsum(np.where(t>=.75,48*np.exp(-np.clip(t-.75,0,None)*1.5)+29,0))/SR)
add(sub*env(.75,.006,.9)*.55)
# 3 · el hilo (1,05): el arco metálico de la pieza — parciales inarmónicos graves, ataque lento, cola larga
for r,a,p in ((1,.5,-.3),(2.76,.28,.25),(5.40,.12,-.1),(8.93,.05,.35)):
    f=98*r; add(np.sin(2*np.pi*f*t+rng.random()*6)*env(1.05,.09,1.4/r**.4)*a*.16*fade,p)
# 4 · descifrado (1,5–2,6): paquetes de datos sordos y regulares, como los que revelan la antena
for k,tk in enumerate(np.arange(1.5,2.62,.0875)):
    f=210+((k*37)%5)*18; add(np.sin(2*np.pi*f*t+2.2*np.sin(2*np.pi*f*1.41*t)*env(tk,.001,.01))*env(tk,.002,.035)*.07,((k%5)-2)/3)
# 5 · lema y créditos: dos pulsos de sub, lejos
for tk in (2.6,3.0): add(np.sin(2*np.pi*55*t)*env(tk,.01,.25)*.22)
# 6 · cola: dron en Re que respira y se apaga con la firma
dr=lp(sum(saw(73.42*(1+d),rng.random()) for d in (-.004,.004))/2,240,2)*.6+np.sin(2*np.pi*36.71*t)*.5
add(dr*np.clip((t-.9)/1.2,0,1)*fade*.16*(1+.15*np.sin(2*np.pi*.35*t)))
# sala oscura (convolución con cola filtrada), sin delay
ir_n=int(SR*2.6); ir=lfilter([.08],[1,-.92],rng.standard_normal(ir_n))*np.exp(-np.arange(ir_n)/SR*2.2); ir/=np.abs(ir).sum()/5
def wet(x): return np.convolve(x,ir)[:n]
L2=L+.3*wet(L); R2=R+.3*wet(R); st=np.stack([L2,R2],1); st*=np.clip((5.5-t)/.25,0,1)[:,None]; st/=np.abs(st).max()/.7
with wave.open(sys.argv[1],'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st*32767).astype('<i2').tobytes())
print('firma ok')
