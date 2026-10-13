import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { projectsApi } from '../../api/projectsApi';
import { messagesApi } from '../../api/messagesApi';
import { useProjectRealtime } from '../../hooks/useProjectRealtime';
import { ProjectChat } from '../../components/chat/ProjectChat';
import { Page, PageHeader, Section } from '../../components/ui/Page';
import { BackButton } from '../../components/ui/BackButton';
import { ErrorState, PageLoader } from '../../components/ui/States';
import { useAuthStore } from '../../stores/authStore';
import { keys } from '../../constants/queryKeys';
import { formatRelative } from '../../utils/dateUtils';

export function ChatPage() {
  const { projectId } = useParams<{ projectId: string }>();
  useProjectRealtime(projectId);
  const myId = useAuthStore((s) => s.user?.id);

  const project = useQuery({
    queryKey: keys.projects.detail(projectId!),
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const members = useQuery({
    queryKey: keys.projects.members(projectId!),
    queryFn: () => projectsApi.getMembers(projectId!),
    enabled: !!projectId,
  });

  const pinned = useQuery({
    queryKey: keys.projects.pinnedMessages(projectId!),
    queryFn: () => messagesApi.pinned(projectId!),
    enabled: !!projectId,
  });

  if (!projectId) return <ErrorState title="Không tìm thấy dự án" />;
  if (project.isLoading) return <PageLoader />;
  if (project.isError) return <ErrorState title="Không mở được dự án này" description="Thử lại sau một lát." />;

  const myRole = members.data?.find((m) => m.userId === myId)?.role;
  // A VIEWER reads the project without taking part in it, which the API enforces too.
  const canPost = myRole === 'OWNER' || myRole === 'MANAGER' || myRole === 'MEMBER';
  const canModerate = myRole === 'OWNER' || myRole === 'MANAGER';

  return (
    <Page>
      <BackButton to={`/projects/${projectId}`} />

      <PageHeader
        title="Chat nhóm"
        description={`Trao đổi về ${project.data?.name ?? 'dự án'}. Gõ @tên để nhắc một thành viên — họ sẽ nhận thông báo.`}
        breadcrumbs={[
          { label: 'Dự án', to: '/projects' },
          { label: project.data?.name ?? '', to: `/projects/${projectId}` },
          { label: 'Chat' },
        ]}
      />

      {!!pinned.data?.length && (
        <Section
          title="Thông báo đã ghim"
          description="Những tin cả nhóm cần đọc, tách ra khỏi dòng chat để không bị trôi."
        >
          <div className="card-flush divide-y divide-line/60 overflow-hidden">
            {pinned.data.map((m) => (
              <div key={m.id} className="flex items-start gap-2.5 p-3">
                <Icon icon="ph:megaphone-duotone" width={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-small text-ink">{m.body}</p>
                  <p className="mt-1 text-caption text-ink-subtle">
                    {m.author.displayName} · {formatRelative(m.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <ProjectChat projectId={projectId} canPost={canPost} canModerate={canModerate} />
    </Page>
  );
}
