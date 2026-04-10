'use client'

import type { AnalysisResult } from '@/types/analysis'

interface Props { data: AnalysisResult | null }

function normalCDF(x: number): number {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911
  const sign=x<0?-1:1
  x=Math.abs(x)/Math.sqrt(2)
  const t=1.0/(1.0+p*x)
  const y=1.0-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x)
  return 0.5*(1.0+sign*y)
}

function bsPrice(S:number,K:number,T:number,r:number,sigma:number,type:string):number {
  if(T<=0||sigma<=0||S<=0) return Math.max(0,type==='call'?S-K:K-S)
  const d1=(Math.log(S/K)+(r+0.5*sigma*sigma)*T)/(sigma*Math.sqrt(T))
  const d2=d1-sigma*Math.sqrt(T)
  if(type==='call') return S*normalCDF(d1)-K*Math.exp(-r*T)*normalCDF(d2)
  return K*Math.exp(-r*T)*normalCDF(-d2)-S*normalCDF(-d1)
}

function priceToColor(price: number, min: number, max: number): string {
  const t=Math.max(0,Math.min(1,(price-min)/(max-min)))
  if(t<0.25) {
    const r=Math.round(14+(t/0.25)*(24-14))
    const g=Math.round(19+(t/0.25)*(95-19))
    const b=Math.round(32+(t/0.25)*(165-32))
    return `rgb(${r},${g},${b})`
  } else if(t<0.5) {
    const tt=(t-0.25)/0.25
    const r=Math.round(24+(tt)*(0-24))
    const g=Math.round(95+(tt)*(229-95))
    const b=Math.round(165+(tt)*(180-165))
    return `rgb(${r},${g},${b})`
  } else if(t<0.75) {
    const tt=(t-0.5)/0.25
    const r=Math.round(0+(tt)*(245-0))
    const g=Math.round(229+(tt)*(166-229))
    const b=Math.round(180+(tt)*(35-180))
    return `rgb(${r},${g},${b})`
  } else {
    const tt=(t-0.75)/0.25
    const r=Math.round(245+(tt)*(255-245))
    const g=Math.round(166+(tt)*(69-166))
    const b=Math.round(35+(tt)*(96-35))
    return `rgb(${r},${g},${b})`
  }
}

export default function PriceHeatmap({data}:Props) {
  if(!data) return null

  const spot=data.spot_price??100,K=data.strike??100,r=data.risk_free_rate??0.0525
  const type=data.option_type??'call'
  const expiry=new Date(data.expiry??''),today=new Date()
  const T=Math.max((expiry.getTime()-today.getTime())/(365*24*60*60*1000),0.01)

  const SPOT_STEPS=10,VOL_STEPS=8
  const spotLow=spot*0.85,spotHigh=spot*1.15
  const volLow=0.10,volHigh=0.60

  const spots:number[]=[],vols:number[]=[],prices:number[][]=[]

  for(let i=0;i<SPOT_STEPS;i++) {
    spots.push(parseFloat((spotLow+i*(spotHigh-spotLow)/(SPOT_STEPS-1)).toFixed(1)))
  }
  for(let j=0;j<VOL_STEPS;j++) {
    vols.push(parseFloat((volLow+j*(volHigh-volLow)/(VOL_STEPS-1)).toFixed(2)))
  }

  let minP=Infinity,maxP=-Infinity
  for(let j=0;j<VOL_STEPS;j++) {
    prices[j]=[]
    for(let i=0;i<SPOT_STEPS;i++) {
      const p=bsPrice(spots[i],K,T,r,vols[j],type)
      prices[j][i]=parseFloat(p.toFixed(2))
      if(p<minP) minP=p
      if(p>maxP) maxP=p
    }
  }

  const currentSpotIdx=spots.reduce((best,s,i)=>Math.abs(s-spot)<Math.abs(spots[best]-spot)?i:best,0)
  const currentVolIdx=vols.reduce((best,v,i)=>Math.abs(v-(data.implied_vol??0.25))<Math.abs(vols[best]-(data.implied_vol??0.25))?i:best,0)

  return (
    <div style={{overflowX:'auto'}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:'8px',minWidth:'420px'}}>
        {/* Y-axis label */}
        <div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',paddingTop:'2px',paddingBottom:'2px',height:`${VOL_STEPS*36}px`,flexShrink:0}}>
          {[...vols].reverse().map(v=>(
            <span key={v} style={{fontSize:'9px',color:'#364A62',fontFamily:'JetBrains Mono,monospace',textAlign:'right',lineHeight:'36px'}}>
              {(v*100).toFixed(0)}%
            </span>
          ))}
        </div>

        {/* Grid */}
        <div style={{flex:1}}>
          {[...Array(VOL_STEPS)].map((_,jRev)=>{
            const j=VOL_STEPS-1-jRev
            return (
              <div key={j} style={{display:'flex',gap:'2px',marginBottom:'2px'}}>
                {spots.map((s,i)=>{
                  const price=prices[j][i]
                  const bg=priceToColor(price,minP,maxP)
                  const isCurrentCell=i===currentSpotIdx&&j===currentVolIdx
                  return (
                    <div
                      key={i}
                      title={`Spot $${s} | IV ${(vols[j]*100).toFixed(0)}% → $${price}`}
                      style={{
                        flex:1,
                        height:'34px',
                        background:bg,
                        borderRadius:'3px',
                        display:'flex',
                        alignItems:'center',
                        justifyContent:'center',
                        border:isCurrentCell?'1.5px solid #DFE8F5':'1px solid transparent',
                        cursor:'default',
                        position:'relative',
                      }}
                    >
                      <span style={{
                        fontSize:'9px',
                        fontFamily:'JetBrains Mono,monospace',
                        fontWeight:700,
                        color: price/(maxP||1)>0.5?'rgba(0,0,0,0.8)':'rgba(255,255,255,0.9)',
                      }}>
                        ${price.toFixed(1)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* X-axis labels */}
          <div style={{display:'flex',gap:'2px',marginTop:'4px'}}>
            {spots.map(s=>(
              <div key={s} style={{flex:1,textAlign:'center'}}>
                <span style={{fontSize:'9px',color:'#364A62',fontFamily:'JetBrains Mono,monospace'}}>${s.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:'flex',justifyContent:'space-between',marginTop:'8px'}}>
        <span style={{fontSize:'9px',color:'#364A62',fontFamily:'JetBrains Mono,monospace'}}>← Spot Price Range →</span>
        <span style={{fontSize:'9px',color:'#364A62',fontFamily:'JetBrains Mono,monospace'}}>↑ IV Range ↑</span>
        <span style={{fontSize:'9px',color:'var(--qt-cyan)',fontFamily:'JetBrains Mono,monospace'}}>■ = current</span>
      </div>
    </div>
  )
}
