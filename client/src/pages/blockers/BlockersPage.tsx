import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../../api/projectsApi';
import { useProjectRealtime } from '../../hooks/useProjectRealtime';
import { BlockersPanel } from '../../components/blockers/BlockersPanel';
import { Page, PageHeader } from '../../components/ui/Page';
import { BackButton } from '../../components/ui/BackButton';
import { ErrorState, PageLoader } from '../../components/ui/States';
import { useAuthStore } from '../../stores/authStore';
import { keys } from '../../constants/queryKeys';

export function BlockersPage() {
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

  if (!projectId) return <ErrorState title="Không tìm thấy dự án" />;
  if (project.isLoading) return <PageLoader />;
  if (project.isError) return <ErrorState title="Không mở được dự án này" description="Thử lại sau một lát." />;

  const myRole = members.data?.find((m) => m.userId === myId)?.role;
  // Anyone doing the work can raise one; deleting the record is the owner's and manager's call.
  const canWrite = myRole === 'OWNER' || myRole === 'MANAGER' || myRole === 'MEMBER';
  const canDelete = myRole === 'OWNER' || myRole === 'MANAGER';

  return (
    <Page>
      <BackButton to={`/projects/${projectId}`} />

      <PageHeader
        title="Khó khăn & rủi ro"
        description="Những gì đang chặn nhóm lại. Ghi ra để cả nhóm thấy, và để sau này còn biết đã xử lý thế nào."
        breadcrumbs={[
          { label: 'Dự án', to: '/projects' },
          { label: project.data?.name ?? '', to: `/projects/${projectId}` },
          { label: 'Khó khăn' },
        ]}
      />

      <BlockersPanel projectId={projectId} canWrite={canWrite} canDelete={canDelete} />
    </Page>
  );
}
