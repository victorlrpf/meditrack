import React, { useState } from 'react';
import AppModal from '../components/AppModal';
import { markOnboarded } from '../services/settings';

export default function FirstAccessModal({
  visible,
  onDone,
}: {
  visible: boolean;
  onDone: () => void;
}) {
  const [error, setError] = useState(false);

  const dismiss = async () => {
    try {
      await markOnboarded();
      onDone();
    } catch (reason) {
      console.warn('Falha ao salvar a confirmação inicial', reason);
      setError(true);
    }
  };

  return (
    <AppModal
      visible={visible}
      title={error ? 'Não foi possível continuar' : 'Bem-vindo ao MediTrack'}
      message={
        error
          ? 'Não conseguimos salvar esta confirmação. Tente novamente.'
          : 'Organize seus medicamentos, confirme os horários e acompanhe o estoque. Seus dados ficam neste aparelho.'
      }
      icon={error ? 'alert-circle-outline' : 'heart-pulse'}
      tone={error ? 'warning' : 'info'}
      onDismiss={() => void dismiss()}
      actions={[
        {
          label: error ? 'Tentar novamente' : 'Entendi',
          onPress: () => void dismiss(),
        },
      ]}
    />
  );
}
