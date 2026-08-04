import api from '@/lib/api'
import { VerificationStatus, VerificationSubmission } from '@/types'

export const verificationService = {
  submit: (cpf: string, selfie: File, document: File) => {
    const formData = new FormData()
    formData.append('cpf', cpf)
    formData.append('selfie', selfie)
    formData.append('document', document)
    return api.post<VerificationSubmission>('/verification/submit', formData).then((r) => r.data)
  },

  me: () => api.get<VerificationStatus>('/verification/me').then((r) => r.data),

  list: (status?: string) =>
    api.get<VerificationSubmission[]>('/verification/', { params: status ? { status } : undefined }).then((r) => r.data),

  photoUrl: (submissionId: string, kind: 'selfie' | 'document') =>
    api.get(`/verification/${submissionId}/photo/${kind}`, { responseType: 'blob' }).then((r) => URL.createObjectURL(r.data)),

  approve: (id: string) => api.patch<VerificationSubmission>(`/verification/${id}/approve`).then((r) => r.data),

  reject: (id: string, reason?: string) =>
    api.patch<VerificationSubmission>(`/verification/${id}/reject`, { reason }).then((r) => r.data),
}
