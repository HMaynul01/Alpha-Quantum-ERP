// Ultra Premium Dashboard V3 — Realtime + AI Insights + Skeleton Loaders
import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts'
import { motion } from 'framer-motion'

const COLORS = ['#00f5ff','#8b5cf6','#10b981','#f59e0b','#f43f5e','#3b82f6']

function useRealtime(setData:any){
  useEffect(()=>{
    const interval = setInterval(async ()=>{
      try{
        const res = await api.get('/reports/dashboard')
        setData(res)
      }catch{}
    },5000)
    return ()=>clearInterval(interval)
  },[setData])
}

function Counter({ value }: { value:number }){
  const [d,setD] = useState(0)
  useEffect(()=>{ setD(value) },[value])
  return <>{d.toLocaleString()}</>
}

function Insight({ data }:any){
  if(!data) return null

  const change = data.monthly_trend?.slice(-2)
  let insight = 'Stable performance'

  if(change?.length===2){
    const diff = change[1].total - change[0].total
    if(diff>0) insight = `📈 Growth of ${diff}`
    if(diff<0) insight = `📉 Drop of ${Math.abs(diff)}`
  }

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}}
      style={{padding:'0.8rem',borderRadius:'16px',background:'rgba(0,255,200,0.08)',color:'#00f5ff'}}>
      {insight}
    </motion.div>
  )
}

export default function Dashboard(){
  const { user } = useAuth()
  const navigate = useNavigate()

  const [data,setData] = useState<any>(null)
  const [loading,setLoading] = useState(true)

  const load = useCallback(()=>{
    api.get('/reports/dashboard').then(setData).finally(()=>setLoading(false))
  },[])

  useEffect(()=>{ load() },[load])
  useRealtime(setData)

  if(loading) return (
    <div style={{padding:'1rem'}}>
      {[1,2,3].map(i=>(
        <div key={i} style={{height:'80px',marginBottom:'0.5rem',borderRadius:'12px',background:'linear-gradient(90deg,#111,#222,#111)',animation:'pulse 1.5s infinite'}} />
      ))}
    </div>
  )

  if(!data) return null

  const pieData = [
    { name:'Approved', value:data.expenses.approved_count },
    { name:'Pending', value:data.expenses.pending_count },
    { name:'Rejected', value:data.expenses.rejected_count },
  ].filter(d=>d.value>0)

  return (
    <div style={{
      padding:'0.8rem',
      display:'flex',
      flexDirection:'column',
      gap:'1rem',
      background:'linear-gradient(135deg,#020617,#0f172a)',
      minHeight:'100vh'
    }}>

      {/* AI INSIGHT */}
      <Insight data={data} />

      {/* KPI */}
      <div style={{display:'flex',gap:'0.7rem',overflowX:'auto'}}>
        {[
          {label:'Revenue',value:data.wallet?.total_invoiced||0},
          {label:'Expenses',value:data.wallet?.total_expenses||0},
          {label:'Balance',value:data.wallet?.balance||0},
        ].map((k,i)=>(
          <motion.div key={i} whileTap={{scale:0.95}}
            style={{minWidth:'140px',padding:'1rem',borderRadius:'16px',background:'rgba(255,255,255,0.05)',color:'#fff'}}>
            <div style={{fontSize:'0.7rem'}}>{k.label}</div>
            <div style={{fontSize:'1.3rem',color:COLORS[i]}}>
              <Counter value={k.value}/>
            </div>
          </motion.div>
        ))}
      </div>

      {/* AREA */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data.monthly_trend}>
          <Area dataKey="total" stroke="#00f5ff" fillOpacity={0.2} fill="#00f5ff" />
          <Tooltip />
        </AreaChart>
      </ResponsiveContainer>

      {/* BAR */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data.monthly_trend}>
          <Bar dataKey="total">
            {data.monthly_trend.map((_,i)=>(<Cell key={i} fill={COLORS[i%COLORS.length]} />))}
          </Bar>
          <Tooltip />
        </BarChart>
      </ResponsiveContainer>

      {/* PIE */}
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={pieData} dataKey="value">
            {pieData.map((_,i)=>(<Cell key={i} fill={COLORS[i]} />))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* LINE */}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data.monthly_trend}>
          <Line dataKey="total" stroke="#10b981" />
        </LineChart>
      </ResponsiveContainer>

    </div>
  )
}
