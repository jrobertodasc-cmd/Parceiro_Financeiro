export function Card({children, className=""}:{children:React.ReactNode, className?:string}) {
  return <div className={`bg-white rounded-2xl border border-zinc-100 shadow-sm p-5 ${className}`}>{children}</div>
}
