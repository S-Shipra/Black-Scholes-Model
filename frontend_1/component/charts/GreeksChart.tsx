'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import type { AnalysisResult } from '@/types/analysis'

interface Props { data: AnalysisResult | null }

function normalCDF(x: number): number {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x)
  return 0.5*(1.0+sign*y)
}

function normalPDF(x: number): number {
  return Math.exp(-0.5*x*x)/Math.sqrt(2*Math.PI)
}

function computeGreeks(S: number, K: number, T: number, r: number, sigma: number, type: string) {
  if (T<=0||sigma<=0||S<=0) return {delta:0,gamma:0,theta:0,vega:0}
  const d1=(Math.log(S/K)+(r+0.5*sigma*sigma)*T)/(sigma*Math.sqrt(T))
  const d2=d1-sigma*Math.sqrt(T)
  const isCall=type==='call'
  const delta =isCall?normalCDF(d1):normalCDF(d1)-1
  const gamma =normalPDF(d1)/(S*sigma*Math.sqrt(T))
  const theta =isCall
    ?(-(S*normalPDF(d1)*sigma)/(2*Math.sqrt(T))-r*K*Math.exp(-r*T)*normalCDF(d2))/365
    :(-(S*normalPDF(d1)*sigma)/(2*Math.sqrt(T))+r*K*Math.exp(-r*T)*normalCDF(-d2))/365
  const vega  =S*normalPDF(d1)*Math.sqrt(T)/100
  return {delta,gamma,theta,vega}
}

function generateData(data: AnalysisResult) {
  const spot=data.spot_price??100,K=data.strike??100,sigma=data.implied_vol??0.25,r=0.045
  const expiry=new Date(data.expiry??''),today=new Date()
  const T=Math.max((expiry.getTime()-today.getTime())/(365*24*60*60*1000),0.01)
  const type=data.option_type??'call'
  const low=spot*0.80,high=spot*1.20,step=(high-low)/20
  const points=[]
  for (let S=low;S<=high;S+=step) {
    const g=computeGreeks(S,K,T,r,sigma,type)
    points.push({
      spot:parseFloat(S.toFixed(2)),
      delta:parseFloat(g.delta.toFixed(4)),
      gamma:parseFloat((g.gamma*10).toFixed(4)),
      theta:parseFloat(g.theta.toFixed(4)),
      vega:parseFloat(g.vega.toFixed(4)),
    })
  }
  return points
}

const CustomTooltip=({active,payload,label}:any)=>{
  if(!active||!payload?.length) return null
  return (
    <div style={{background:'#0E1320',border:'0.5px solid #162030',borderRadius:'6px',padding:'10px 14px',fontFamily:'JetBrains Mono,monospace',fontSize:'11px'}}>
      <p style={{color:'#364A62',marginBottom:'6px'}}>Spot: ${label}</p>
      {payload.map((p:any)=>(
        <p key={p.dataKey} style={{color:p.color,marginBottom:'2px'}}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

export default function GreeksChart({data}:Props) {
  if(!data) return null
  const chartData=generateData(data)
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chartData} margin={{top:5,right:10,left:-10,bottom:5}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#0E1A28"/>
        <XAxis dataKey="spot" tick={{fill:'#364A62',fontSize:10,fontFamily:'JetBrains Mono,monospace'}} tickFormatter={(v)=>`$${v}`}/>
        <YAxis tick={{fill:'#364A62',fontSize:10,fontFamily:'JetBrains Mono,monospace'}}/>
        <Tooltip content={<CustomTooltip/>}/>
        <Legend wrapperStyle={{fontSize:'10px',fontFamily:'JetBrains Mono,monospace',color:'#364A62'}}/>
        <ReferenceLine x={data.spot_price??100} stroke="#364A62" strokeDasharray="4 4"/>
        <Line type="monotone" dataKey="delta" name="Delta"       stroke="#00E5B4" strokeWidth={1.5} dot={false}/>
        <Line type="monotone" dataKey="gamma" name="Gamma (×10)" stroke="#DFE8F5" strokeWidth={1.5} dot={false}/>
        <Line type="monotone" dataKey="theta" name="Theta"       stroke="#FF4560" strokeWidth={1.5} dot={false}/>
        <Line type="monotone" dataKey="vega"  name="Vega"        stroke="#F5A623" strokeWidth={1.5} dot={false}/>
      </LineChart>
    </ResponsiveContainer>
  )
}
