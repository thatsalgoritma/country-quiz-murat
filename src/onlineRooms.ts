import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface OnlineRoom {
  id: string;
  code: string;
  mode: string;
  status: "waiting" | "playing" | "finished";
  active_player: 1 | 2;
}

export interface OnlineAnswer {
  room_id: string;
  target_key: string;
  player_number: 1 | 2;
}

function client() {
  if (!supabase) throw new Error("Supabase yapılandırması bulunamadı.");
  return supabase;
}

export async function ensureAnonymousPlayer() {
  const database = client();
  const { data: sessionData } = await database.auth.getSession();
  if (sessionData.session) return sessionData.session.user;

  const { data, error } = await database.auth.signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error("Anonim oyuncu oluşturulamadı.");
  return data.user;
}

export async function createOnlineRoom(code: string, mode: string, displayName: string) {
  await ensureAnonymousPlayer();
  const { data, error } = await client().rpc("create_game_room", {
    p_code: code,
    p_mode: mode,
    p_display_name: displayName,
  });
  if (error) throw error;
  return data as OnlineRoom;
}

export async function joinOnlineRoom(code: string, displayName: string) {
  await ensureAnonymousPlayer();
  const { data, error } = await client().rpc("join_game_room", {
    p_code: code,
    p_display_name: displayName,
  });
  if (error) throw error;
  return data as OnlineRoom;
}

export async function submitOnlineAnswer(roomId: string, targetKey: string) {
  const { data, error } = await client().rpc("submit_game_answer", {
    p_room_id: roomId,
    p_target_key: targetKey,
  });
  if (error) throw error;
  return data as boolean;
}

export async function passOnlineTurn(roomId: string) {
  const { error } = await client().rpc("pass_game_turn", { p_room_id: roomId });
  if (error) throw error;
}

export function subscribeToRoom(roomId: string, onChange: () => void): RealtimeChannel {
  return client()
    .channel(`room:${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "game_rooms", filter: `id=eq.${roomId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "game_room_players", filter: `room_id=eq.${roomId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "game_room_answers", filter: `room_id=eq.${roomId}` }, onChange)
    .subscribe();
}
