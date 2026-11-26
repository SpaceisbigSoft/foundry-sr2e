import heapq, collections
# Terminals: skills (S:) and attributes (A:); junctions j*, dots d* (each dot passed = 1).
U=[]; D=[]  # undirected, directed (tracing direction)
def u(*chain):
    for a,b in zip(chain,chain[1:]): U.append((a,b))
def d(a,b): D.append((a,b))
# Quickness
u('A:Quickness','jQ'); u('jQ','jAS'); u('jAS','dA','S:Athletics'); u('jAS','dS1','dS2','S:Stealth')
u('jQ','dC1','dC2','S:Firearms'); u('dC2','S:Gunnery'); u('dC1','dP','S:Projectile Weapons'); u('dP','S:Throwing Weapons')
for s in ['Firearms','Gunnery','Projectile Weapons','Throwing Weapons','Armed Combat']: u('S:'+s,'dBR_'+s,'S:'+s+' B/R')
d('jQ','jCV'); u('A:Strength','dSt'); d('dSt','jCV'); u('A:Body','dB1','dB2'); d('dB2','jCV')
u('jCV','dAC','S:Armed Combat'); u('jCV','dUC','S:Unarmed Combat')
# technical, left
u('jLV','d597a','d597b','S:Physical Sciences'); u('jLV','d220c','S:Computer'); u('d220c','S:Electronics'); u('jLV','d162','d220b','S:Biotech')
u('S:Computer','jCR','dCB','S:Computer B/R'); u('jCR','d570a','S:Computer Theory')
u('S:Electronics','dEB','S:Electronics B/R')
u('S:Biotech','jBR','dBB','S:Biotech B/R'); u('jBR','d570b','jCyB'); u('jCyB','S:Cybertechnology'); u('jCyB','d627b','S:Biology')
# knowledge vertical
u('S:Physical Sciences','k240','k300','k362','k440','k497','k562','S:Biology'); u('k362','S:Computer Theory'); u('k440','S:Cybertechnology')
u('k300','jBrk'); u('k497','jBrk')
# Intelligence trunk
u('A:Intelligence','dI0','jIT'); u('jIT','dDm1','dDm2'); d('dDm2','S:Demolitions'); d('jIT','jBrk'); u('jIT','dT830','d828'); d('d828','jV')
u('jV','V1'); u('jV','V2'); u('V1','d633b','S:Psychology'); u('d633a','d633b','d633c','S:Sociology'); u('d633a','d570m','S:Military Theory')
u('V2','d633m','S:Magical Theory'); u('A:Willpower','dW'); d('dW','jV')
# Psychology left, to Charisma
u('S:Psychology','dPL','dSo','S:Sociology'); u('dPL','jPC'); d('jPC','jCH')
d('A:Charisma','jCH'); u('jCH','dCh0','dL','S:Leadership'); u('dL','jCV2','S:Etiquette'); u('jCV2','dIN','S:Interrogation'); u('dIN','S:Negotiation')
# magic
u('S:Magical Theory','dMT','jMV','dSor','S:Sorcery'); u('jMV','dCj','S:Conjuring')
# Reaction
u('A:Reaction','jRT','dTr','jRT2')
u('jRT','G1','G2','S:Bike'); u('G2','S:Hovercraft'); u('G2','S:Car'); u('G1','GB','S:Ground Vehicles B/R')
u('jRT','B1','B2','S:Sailboat'); u('B2','S:Motorboat'); u('B1','BB','S:Boats B/R')
u('jRT2','A1','A2','S:Rotorcraft'); u('A2','S:Fixed-wing Aircraft'); u('A2','S:Vectored Thrust'); u('A1','AB','S:Aircraft B/R')
adj=collections.defaultdict(list)
for a,b in U: adj[a].append(b); adj[b].append(a)
for a,b in D: adj[a].append(b)
term=lambda n: n.startswith('S:') or n.startswith('A:')
def reach(src):
    dist={src:0}; pq=[(0,src)]; out={}
    while pq:
        c,n=heapq.heappop(pq)
        if c>dist.get(n,1e9): continue
        if n!=src and term(n):
            if n.startswith('S:') and (n not in out or c<out[n]): out[n]=c
            continue  # adjacent pairs only: terminals are not passed here (BFS in the system composes them)
        for m in adj[n]:
            nc=c+(1 if m.startswith(('d','k','G','B','A1','A2','AB','V')) and not term(m) else 0)
            if nc<dist.get(m,1e9): dist[m]=nc; heapq.heappush(pq,(nc,m))
    return out
nodes=sorted({x for e in U+D for x in e if term(x)})
pairs={}
for n in nodes:
    for m,c in reach(n).items(): pairs[(n,m)]=c
lines=[]; seen=set()
for (a,b),c in sorted(pairs.items()):
    if a.startswith('A:'):
        lines.append(f"{a[2:]} > {b[2:]}: {c}"); continue
    key=tuple(sorted((a,b)))
    if key in seen: continue
    seen.add(key)
    back=pairs.get((b,a))
    # (a needed -> b had) costs c; (b needed -> a had) costs back
    if back==c: lines.append(f"{a[2:]} - {b[2:]}: {c}")
    else:
        lines.append(f"{b[2:]} > {a[2:]}: {c}")   # having b serves for a
        if back is not None: lines.append(f"{a[2:]} > {b[2:]}: {back}")
for l in lines: print(l)
print(len(lines), 'links', file=__import__('sys').stderr)
