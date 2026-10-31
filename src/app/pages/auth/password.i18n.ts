import { Dict } from '../../core/i18n/lang.service';

// Textos de «¿Olvidaste tu contraseña?» y «Restablecer contraseña» (pantallas sin sesión) en los tres idiomas.
const ES = {
  forgot: {
    title: '¿Olvidaste tu contraseña?',
    lead: 'Ingresá tu correo o usuario y te mandamos instrucciones para restablecerla.',
    label: 'Correo o nombre de usuario',
    placeholder: 'correo@empresa.com',
    send: 'Enviar instrucciones',
    sent: 'Si el dato ingresado corresponde a una cuenta activa, te llegó un correo con el link para restablecer tu contraseña. Revisá también spam.',
    back: 'Volver al inicio de sesión',
    errEmpty: 'Ingresá tu correo o nombre de usuario.'
  },
  reset: {
    title: 'Restablecer contraseña',
    lead: 'Elegí tu nueva contraseña.',
    noToken: 'Este link no es válido, no contiene un token.',
    newLabel: 'Nueva contraseña',
    prompt: 'Elegí una contraseña',
    weak: 'Débil',
    medium: 'Media',
    strong: 'Fuerte',
    hint: 'Mínimo 8 caracteres, con mayúscula, minúscula y un carácter especial.',
    confirmLabel: 'Confirmar contraseña',
    submit: 'Restablecer contraseña',
    done: 'Tu contraseña se actualizó correctamente. Ya podés iniciar sesión.',
    back: 'Ir al inicio de sesión',
    errShort: 'La contraseña debe tener al menos 8 caracteres.',
    errMismatch: 'Las contraseñas no coinciden.',
    errExpired: 'El link venció o ya fue usado. Pedí uno nuevo desde "¿Olvidaste tu contraseña?".'
  }
};

export type PasswordTx = typeof ES;

const PT: PasswordTx = {
  forgot: {
    title: 'Esqueceu a senha?',
    lead: 'Digite o seu e-mail ou usuário e enviaremos as instruções para redefini-la.',
    label: 'E-mail ou nome de usuário',
    placeholder: 'email@empresa.com',
    send: 'Enviar instruções',
    sent: 'Se o dado informado corresponder a uma conta ativa, você recebeu um e-mail com o link para redefinir a senha. Confira também o spam.',
    back: 'Voltar ao login',
    errEmpty: 'Digite o seu e-mail ou nome de usuário.'
  },
  reset: {
    title: 'Redefinir senha',
    lead: 'Escolha a sua nova senha.',
    noToken: 'Este link não é válido: não contém um token.',
    newLabel: 'Nova senha',
    prompt: 'Escolha uma senha',
    weak: 'Fraca',
    medium: 'Média',
    strong: 'Forte',
    hint: 'Mínimo de 8 caracteres, com letra maiúscula, minúscula e um caractere especial.',
    confirmLabel: 'Confirmar senha',
    submit: 'Redefinir senha',
    done: 'Sua senha foi atualizada com sucesso. Agora você já pode entrar.',
    back: 'Ir para o login',
    errShort: 'A senha deve ter pelo menos 8 caracteres.',
    errMismatch: 'As senhas não coincidem.',
    errExpired: 'O link expirou ou já foi usado. Peça um novo em "Esqueceu a senha?".'
  }
};

const EN: PasswordTx = {
  forgot: {
    title: 'Forgot your password?',
    lead: 'Enter your email or username and we will send you instructions to reset it.',
    label: 'Email or username',
    placeholder: 'email@company.com',
    send: 'Send instructions',
    sent: 'If the information you entered matches an active account, you have received an email with the link to reset your password. Check your spam folder too.',
    back: 'Back to log in',
    errEmpty: 'Enter your email or username.'
  },
  reset: {
    title: 'Reset password',
    lead: 'Choose your new password.',
    noToken: 'This link is not valid: it does not contain a token.',
    newLabel: 'New password',
    prompt: 'Choose a password',
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong',
    hint: 'At least 8 characters, with an uppercase letter, a lowercase letter and a special character.',
    confirmLabel: 'Confirm password',
    submit: 'Reset password',
    done: 'Your password was updated successfully. You can now log in.',
    back: 'Go to log in',
    errShort: 'The password must be at least 8 characters long.',
    errMismatch: 'The passwords do not match.',
    errExpired: 'The link has expired or was already used. Request a new one from "Forgot your password?".'
  }
};

export const PASSWORD_TX: Dict<PasswordTx> = { es: ES, pt: PT, en: EN };
