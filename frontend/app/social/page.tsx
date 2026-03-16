"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Users, Plus, UserPlus, Search, Check, X } from "lucide-react";
import api from "@/lib/api";

export default function SocialPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"friends"|"groups"|"pending">("friends");
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [msg, setMsg] = useState("");

  const loadData = async () => {
    try {
      const [f, g, p] = await Promise.all([
        api.get("/social/friends"),
        api.get("/social/groups"),
        api.get("/social/friends/pending"),
      ]);
      setFriends(f.data);
      setGroups(g.data);
      setPending(p.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const searchUsers = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    try {
      const { data } = await api.get(`/social/users/search?email=${encodeURIComponent(searchEmail)}`);
      setSearchResults(data);
      if (data.length === 0) setMsg("No users found with that email");
    } catch { setMsg("Search failed"); }
    finally { setSearching(false); }
  };

  const sendRequest = async (targetId: string, name: string) => {
    try {
      await api.post(`/social/friends/${targetId}`);
      setMsg(`Friend request sent to ${name}!`);
      setSearchResults([]);
      setSearchEmail("");
    } catch (e: any) {
      setMsg(e.response?.data?.detail || "Failed to send request");
    }
  };

  const acceptRequest = async (friendshipId: string) => {
    await api.post(`/social/friends/${friendshipId}/accept`);
    setMsg("Friend request accepted!");
    loadData();
  };

  const createGroup = async () => {
    if (!newName) return;
    await api.post("/social/groups", { name: newName, topic: newTopic });
    setShowCreate(false); setNewName(""); setNewTopic("");
    loadData();
  };

  const joinGroup = async (id: string) => {
    await api.post(`/social/groups/${id}/join`);
    setMsg("Joined group!");
    loadData();
  };

  return (
    <div className="min-h-screen mesh-bg p-8">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
          <ChevronLeft size={15}/>Back
        </button>
        <h1 className="text-2xl font-bold mb-1">Social Practice</h1>
        <p className="text-slate-400 text-sm mb-6">Connect with others and practice together</p>

        {msg && (
          <div className="mb-4 flex items-center justify-between bg-brand-600/15 border border-brand-500/25 rounded-xl px-4 py-3 text-sm text-brand-300">
            {msg}
            <button onClick={() => setMsg("")}><X size={13}/></button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 glass rounded-xl border border-white/5 mb-5 w-fit">
          {[
            { k:"friends", l:`Friends ${friends.length > 0 ? `(${friends.length})` : ""}` },
            { k:"pending", l:`Requests ${pending.length > 0 ? `(${pending.length})` : ""}` },
            { k:"groups",  l:"Groups" },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k as any)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${tab===t.k?"bg-brand-600 text-white":"text-slate-400 hover:text-white"}`}>
              {t.l}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="shimmer rounded-xl h-14"/>)}
          </div>
        ) : (
          <>
            {/* Friends tab */}
            {tab === "friends" && (
              <div className="space-y-4">
                {/* Search to add friends */}
                <div className="glass rounded-xl p-4 border border-white/5">
                  <p className="text-xs text-slate-400 font-medium mb-3 flex items-center gap-1.5">
                    <UserPlus size={13}/>Add friend by email
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={searchEmail}
                      onChange={e => setSearchEmail(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && searchUsers()}
                      placeholder="Enter email address..."
                      className="input-field text-sm py-2 flex-1"
                    />
                    <button onClick={searchUsers} disabled={searching}
                      className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
                      <Search size={13}/>{searching ? "..." : "Search"}
                    </button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {searchResults.map(u => (
                        <div key={u.id}
                          className="flex items-center justify-between glass-light rounded-lg px-3 py-2.5">
                          <div>
                            <p className="text-sm font-medium">{u.full_name || "User"}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                          <button onClick={() => sendRequest(u.id, u.full_name || u.email)}
                            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                            <UserPlus size={11}/>Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Friends list */}
                {friends.length === 0 ? (
                  <div className="glass rounded-2xl p-10 border border-dashed border-white/8 text-center">
                    <Users className="mx-auto mb-3 text-slate-700" size={28}/>
                    <p className="text-sm font-medium mb-1">No friends yet</p>
                    <p className="text-xs text-slate-600">Search by email above to add friends</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friends.map(f => (
                      <div key={f.id}
                        className="flex items-center justify-between glass rounded-xl px-5 py-3.5 border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-sm font-bold">
                            {f.full_name?.[0] || "U"}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{f.full_name}</p>
                            <p className="text-xs text-slate-500">{f.target_role || "No role set"}</p>
                          </div>
                        </div>
                        <button onClick={() => router.push("/interview")}
                          className="text-xs bg-brand-600/15 border border-brand-500/25 text-brand-400 px-3 py-1.5 rounded-lg hover:bg-brand-600/25 transition-colors">
                          Challenge
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pending requests tab */}
            {tab === "pending" && (
              <div>
                {pending.length === 0 ? (
                  <div className="glass rounded-2xl p-10 border border-dashed border-white/8 text-center">
                    <Check className="mx-auto mb-3 text-slate-700" size={28}/>
                    <p className="text-sm font-medium mb-1">No pending requests</p>
                    <p className="text-xs text-slate-600">Friend requests you receive will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pending.map(req => (
                      <div key={req.friendship_id}
                        className="flex items-center justify-between glass rounded-xl px-5 py-3.5 border border-white/5">
                        <div>
                          <p className="text-sm font-medium">{req.full_name || "User"}</p>
                          <p className="text-xs text-slate-500">{req.email}</p>
                        </div>
                        <button onClick={() => acceptRequest(req.friendship_id)}
                          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                          <Check size={11}/>Accept
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Groups tab */}
            {tab === "groups" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-slate-500">{groups.length} groups</p>
                  <button onClick={() => setShowCreate(!showCreate)}
                    className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5">
                    <Plus size={12}/>Create group
                  </button>
                </div>
                {showCreate && (
                  <div className="glass rounded-xl p-4 border border-brand-500/20 mb-3 space-y-2">
                    <input value={newName} onChange={e => setNewName(e.target.value)}
                      placeholder="Group name" className="input-field text-sm py-2"/>
                    <input value={newTopic} onChange={e => setNewTopic(e.target.value)}
                      placeholder="Topic (e.g. Data Science Interviews)"
                      className="input-field text-sm py-2"/>
                    <div className="flex gap-2">
                      <button onClick={createGroup} className="btn-primary flex-1 py-2 text-sm">Create</button>
                      <button onClick={() => setShowCreate(false)}
                        className="btn-ghost flex-1 py-2 text-sm">Cancel</button>
                    </div>
                  </div>
                )}
                {groups.length === 0 ? (
                  <div className="glass rounded-2xl p-10 border border-dashed border-white/8 text-center">
                    <Users className="mx-auto mb-3 text-slate-700" size={28}/>
                    <p className="text-sm font-medium mb-1">No groups yet</p>
                    <p className="text-xs text-slate-600">Create one to practice with others</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groups.map(g => (
                      <div key={g.id}
                        className="flex items-center justify-between glass rounded-xl px-5 py-3.5 border border-white/5">
                        <div>
                          <p className="text-sm font-medium">{g.name}</p>
                          <p className="text-xs text-slate-500">
                            {g.topic || "General"} · {g.member_count} members
                          </p>
                        </div>
                        <button onClick={() => joinGroup(g.id)}
                          className="btn-ghost text-xs px-3 py-1.5 border border-white/8">
                          Join
                        </button>
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
