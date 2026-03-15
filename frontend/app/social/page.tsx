"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Users, Plus, UserPlus } from "lucide-react";
import api from "@/lib/api";

export default function SocialPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"friends"|"groups">("groups");
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/social/friends"), api.get("/social/groups")])
      .then(([f,g]) => { setFriends(f.data); setGroups(g.data); })
      .finally(() => setLoading(false));
  }, []);

  const createGroup = async () => {
    if (!newName) return;
    await api.post("/social/groups", { name: newName, topic: newTopic });
    setShowCreate(false); setNewName(""); setNewTopic("");
    const { data } = await api.get("/social/groups");
    setGroups(data);
  };

  const joinGroup = async (id: string) => {
    await api.post(`/social/groups/${id}/join`);
    const { data } = await api.get("/social/groups");
    setGroups(data);
  };

  return (
    <div className="min-h-screen mesh-bg p-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={()=>router.push("/dashboard")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6"><ChevronLeft size={15}/>Back</button>
        <h1 className="text-2xl font-bold mb-1">Social Practice</h1>
        <p className="text-slate-400 text-sm mb-6">Connect with others and practice together</p>

        <div className="flex gap-1 p-1 glass rounded-xl border border-white/5 mb-5 w-fit">
          {[{k:"friends",l:"Friends"},{k:"groups",l:"Groups"}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k as any)}
              className={`px-5 py-2 rounded-lg text-sm transition-all ${tab===t.k?"bg-brand-600 text-white":"text-slate-400 hover:text-white"}`}>{t.l}</button>
          ))}
        </div>

        {loading ? <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="shimmer rounded-xl h-14"/>)}</div> : (
          <>
            {tab==="friends" && (
              <div>
                {friends.length===0 ? (
                  <div className="glass rounded-2xl p-10 border border-dashed border-white/8 text-center">
                    <UserPlus className="mx-auto mb-3 text-slate-700" size={28}/>
                    <p className="text-sm font-medium mb-1">No friends yet</p>
                    <p className="text-xs text-slate-600">Share your profile to connect with other learners</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friends.map(f=>(
                      <div key={f.id} className="flex items-center justify-between glass rounded-xl px-5 py-3.5 border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-sm font-bold">{f.full_name?.[0]||"U"}</div>
                          <div><p className="text-sm font-medium">{f.full_name}</p><p className="text-xs text-slate-500">{f.target_role||"No role set"}</p></div>
                        </div>
                        <button onClick={()=>router.push(`/interview`)}
                          className="text-xs bg-brand-600/15 border border-brand-500/25 text-brand-400 px-3 py-1.5 rounded-lg hover:bg-brand-600/25 transition-colors">Challenge</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab==="groups" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-slate-500">{groups.length} groups</p>
                  <button onClick={()=>setShowCreate(!showCreate)}
                    className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"><Plus size={12}/>Create</button>
                </div>
                {showCreate && (
                  <div className="glass rounded-xl p-4 border border-brand-500/20 mb-3 space-y-2">
                    <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Group name" className="input-field text-sm py-2"/>
                    <input value={newTopic} onChange={e=>setNewTopic(e.target.value)} placeholder="Topic (e.g. Data Science Interviews)" className="input-field text-sm py-2"/>
                    <button onClick={createGroup} className="btn-primary w-full py-2 text-sm">Create Group</button>
                  </div>
                )}
                {groups.length===0 ? (
                  <div className="glass rounded-2xl p-10 border border-dashed border-white/8 text-center">
                    <Users className="mx-auto mb-3 text-slate-700" size={28}/>
                    <p className="text-sm font-medium mb-1">No groups yet</p>
                    <p className="text-xs text-slate-600">Create one and invite friends to practice together</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groups.map(g=>(
                      <div key={g.id} className="flex items-center justify-between glass rounded-xl px-5 py-3.5 border border-white/5">
                        <div><p className="text-sm font-medium">{g.name}</p><p className="text-xs text-slate-500">{g.topic||"General"} · {g.member_count} members</p></div>
                        <button onClick={()=>joinGroup(g.id)} className="btn-ghost text-xs px-3 py-1.5 border border-white/8">Join</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
