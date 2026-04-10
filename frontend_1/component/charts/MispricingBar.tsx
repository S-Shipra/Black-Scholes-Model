'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer, ReferenceLine, LabelList
} from 'recharts'
import type { AnalysisResult } from '@/types/analysis'

interface Props { data: AnalysisResult | null }

const CustomTooltip=({active,payload,label}:any)=>{
  if(!active||!payload?.length) return null
  return (
    <div style={{background:'#0E1320',border:'0.5px solid #162030',borderRadius:'6px',padding:'10px 14px',fontFamily:'JetBrains Mono,monospace',fontSize:'11px'}}>
      <p style={{color:'#364A62',marginBottom:'6px'}}>{label}</p>
      {payload.map((p:any)=>(
        <p key={p.name} style={{color:p.color??'var(--qt-text)',marginBottom:'2px'}}>
          {p.name}: ${typeof p.value==='number'?p.value.toFixed(2):p.value}
        </p>
      ))}
    </div>
  )
}

export default function MispricingBar({data}:Props) {
  if(!data) return null

  const bsPrice=data.bs_price??0
  const marketPrice=data.market_price??0
  const mispricingPct=data.mispricing_pct??0
  const isUnderpriced=mispricingPct<0

  const barData=[
    {name:'BS Theoretical', value:bsPrice,     color:'#00E5B4'},
    {name:'Market Price',   value:marketPrice,  color: isUnderpriced?'#F5A623':'#FF4560'},
  ]

  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={barData} margin={{top:16,right:10,left:-10,bottom:5}} barSize={48}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0E1A28" vertical={false}/>
          <XAxis
            dataKey="name"
            tick={{fill:'#364A62',fontSize:10,fontFamily:'JetBrains Mono,monospace'}}
            axisLine={false} tickLine={false}
          />
          <YAxis
            tick={{fill:'#364A62',fontSize:10,fontFamily:'JetBrains Mono,monospace'}}
            tickFormatter={(v)=>`$${v}`}
            domain={[0,'auto']}
          />
          <Tooltip content={<CustomTooltip/>}/>
          <ReferenceLine
            y={bsPrice} stroke="#364A62" strokeDasharray="4 4"
            label={{value:'BS fair value',fill:'#364A62',fontSize:9,position:'insideTopRight'}}
          />
          <Bar dataKey="value" name="Price" radius={[4,4,0,0]}>
            {barData.map((entry,index)=>(
              <Cell key={index} fill={entry.color} fillOpacity={0.85}/>
            ))}
            <LabelList
  dataKey="value"
  position="top"
  content={(props: any) => {
    const { x, y, width, value } = props
    return (
      <text
        x={Number(x) + Number(width) / 2}
        y={Number(y) - 6}
        fill="#DFE8F5"
        fontSize={11}
        fontFamily="JetBrains Mono, monospace"
        fontWeight={700}
        textAnchor="middle"
      >
        ${typeof value === 'number' ? value.toFixed(2) : value}
      </text>
    )
  }}
/>
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Gap annotation */}
      <div style={{
        marginTop:'8px',
        padding:'8px 12px',
        background:isUnderpriced?'rgba(245,166,35,0.06)':'rgba(255,69,96,0.06)',
        border:`0.5px solid ${isUnderpriced?'rgba(245,166,35,0.2)':'rgba(255,69,96,0.2)'}`,
        borderRadius:'6px',
        display:'flex',
        justifyContent:'space-between',
        alignItems:'center',
      }}>
        <span style={{fontSize:'10px',color:'#364A62',fontFamily:'JetBrains Mono,monospace',textTransform:'uppercase',letterSpacing:'0.06em'}}>
          Gap
        </span>
        <span style={{
          fontSize:'13px',fontWeight:700,
          color:isUnderpriced?'#F5A623':'#FF4560',
          fontFamily:'JetBrains Mono,monospace',
        }}>
          {mispricingPct>0?'+':''}{mispricingPct.toFixed(2)}% — {isUnderpriced?'Underpriced → BUY signal':'Overpriced → SELL signal'}
        </span>
      </div>
    </div>
  )
}
