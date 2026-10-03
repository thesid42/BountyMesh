import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { subscribeSupabaseChanges } from "../src/lib/repository";

test("concurrent realtime listeners use independent channels and cleanup independently", async () => {
  type FakeChannel = {
    name: string;
    active: boolean;
    subscribed: boolean;
    callback?: () => void;
    on: (event: string, filter: { table: string }, callback: () => void) => FakeChannel;
    subscribe: () => FakeChannel;
  };
  const channels = new Map<string, FakeChannel>();
  const removed: FakeChannel[] = [];
  const fakeClient = {
    channel(name: string) {
      const existing = channels.get(name);
      if (existing) return existing;
      const channel: FakeChannel = {
        name,
        active: true,
        subscribed: false,
        on(_event, _filter, callback) {
          if (channel.subscribed) throw new Error("cannot add postgres_changes callbacks after subscribe");
          channel.callback = callback;
          return channel;
        },
        subscribe() {
          channel.subscribed = true;
          return channel;
        },
      };
      channels.set(name, channel);
      return channel;
    },
    removeChannel(channel: FakeChannel) {
      channel.active = false;
      removed.push(channel);
      return Promise.resolve("ok");
    },
  } as unknown as SupabaseClient;

  let firstEvents = 0;
  let secondEvents = 0;
  const stopFirst = subscribeSupabaseChanges(fakeClient, () => { firstEvents++; });
  const stopSecond = subscribeSupabaseChanges(fakeClient, () => { secondEvents++; });
  const [first, second] = [...channels.values()];

  assert.ok(first && second);
  assert.notEqual(first.name, second.name);
  assert.equal(first.name.startsWith("bountymesh-snapshot-stream-"), true);
  assert.equal(second.name.startsWith("bountymesh-snapshot-stream-"), true);

  stopFirst();
  stopFirst();
  assert.equal(removed.length, 1);
  assert.equal(first.active, false);
  assert.equal(second.active, true);
  if (second.callback) second.callback();
  assert.equal(firstEvents, 0);
  assert.equal(secondEvents, 1);

  stopSecond();
  await Promise.resolve();
  assert.equal(removed.length, 2);
  assert.equal(second.active, false);
});
