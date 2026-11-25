import PublicFriendClosetClient from "./PublicFriendClosetClient";

export function generateStaticParams() {
  return [
    { username: "mila" },
    { username: "maya" },
    { username: "chloe" },
    { username: "sofia" },
  ];
}

export default function PublicFriendClosetPage() {
  return <PublicFriendClosetClient />;
}
