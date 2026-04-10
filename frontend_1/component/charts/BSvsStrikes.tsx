'use client'

import {
  ComposedChart, Line, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
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

const CustomTooltip=({active,payload,label}:any)=>{
  if(!active||!payload?.length) return null
  return (
    <div style={{background:'#0E1320',border:'0.5px solid #162030',borderRadius:'6px',padding:'10px 14px',fontFamily:'JetBrains Mono,monospace',fontSize:'11px'}}>
      <p style={{color:'#364A62',marginBottom:'6px'}}>Strike: ${label}</p>
      {payload.map((p:any)=>(
        <p key={p.name} style={{color:p.color,marginBottom:'2px'}}>{p.name}: ${typeof p.value==='number'?p.value.toFixed(2):p.value}</p>
      ))}
    </div>
  )
}

export default function BSvsStrikes({data}:Props) {
  if(!data) return null

  const spot=data.spot_price??100,sigma=data.implied_vol??0.25,r=0.045
  const type=data.option_type??'call'
  const selectedStrike=data.strike??100
  const expiry=new Date(data.expiry??''),today=new Date()
  const T=Math.max((expiry.getTime()-today.getTime())/(365*24*60*60*1000),0.01)

  const low=spot*0.75,high=spot*1.25,step=(high-low)/20
  const lineData=[]
  for(let K=low;K<=high;K+=step) {
    lineData.push({
      strike:parseFloat(K.toFixed(1)),
      bsPrice:parseFloat(bsPrice(spot,K,T,r,sigma,type).toFixed(2)),
    })
  }

  // Market prices from chain if available
  const chainData=data.options_chain as any[]|undefined
  let scatterData:Array<{strike:number,marketPrice:number}>=[]
  if(chainData&&chainData.length>0) {
    scatterData=chainData
      .filter((c:any)=>c.bid>0&&c.ask>0)
      .map((c:any)=>({
        strike:c.strike,
        marketPrice:parseFloat(((c.bid+c.ask)/2).toFixed(2)),
      }))
  } else {
    // Show just the selected point
    scatterData=[{strike:selectedStrike,marketPrice:data.market_price??0}]
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart margin={{top:5,right:10,left:-10,bottom:5}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#0E1A28"/>
        <XAxis
          dataKey="strike" type="number" domain={['auto','auto']}
          tick={{fill:'#364A62',fontSize:10,fontFamily:'JetBrains Mono,monospace'}}
          tickFormatter={(v)=>`$${v}`}
        />
        <YAxis
          tick={{fill:'#364A62',fontSize:10,fontFamily:'JetBrains Mono,monospace'}}
          tickFormatter={(v)=>`$${v}`}
        />
        <Tooltip content={<CustomTooltip/>}/>
        <ReferenceLine x={selectedStrike} stroke="#364A62" strokeDasharray="4 4"/>
        <Line
          data={lineData} type="monotone" dataKey="bsPrice" name="BS Price"
          stroke="#00E5B4" strokeWidth={2} dot={false}
        />
        <Scatter
          data={scatterData} dataKey="marketPrice" name="Market Price"
          fill="#F5A623" r={4}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
