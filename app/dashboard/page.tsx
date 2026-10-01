import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import { catImageUrl, getDashboard, imageUrl } from "@/lib/data";
import DashboardView from "../dashboard";
import { importLegacyAction } from "./actions";
import { createUploadToken } from "@/lib/upload-auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");
  const data = await getDashboard(user.userId);
  const uploadToken = await createUploadToken(user.userId);
  return (
    <DashboardView
      initialData={{
        cat: { ...(data.cat as { id: string; name: string; birth_date: string; breed: string; bio: string; profile_image_key: string | null }), imageUrl: catImageUrl(data.cat) },
        logs: data.logs,
        album: data.album.map((entry) => ({ ...entry, imageUrl: imageUrl(entry) })),
        comments: data.comments,
        guestbook: data.guestbook,
      }}
      userName={user.fullName ?? user.email.split("@")[0]}
      signOutPath={chatGPTSignOutPath("/album/tori")}
      legacyImportAction={importLegacyAction}
      uploadToken={uploadToken}
    />
  );
}
