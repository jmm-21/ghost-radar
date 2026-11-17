/** Una cuenta normalizada, venga de la red que venga. */
export interface Account {
  /** Clave única para comparar (nombre en minúsculas o `id:<número>` en X). */
  key: string;
  /** Nombre de usuario tal y como aparece en la red (vacío si solo hay id). */
  handle: string;
  /** Id numérico (solo X/Twitter, que no incluye nombres en su exportación). */
  id?: string;
  /** Momento en que empezó la relación, en milisegundos. 0 si no se conoce. */
  ts: number;
  /** Formato del que se ha leído. */
  source: 'meta' | 'tiktok' | 'x';
}

export interface RawLists {
  followers: Account[];
  following: Account[];
}

/** Archivo de texto ya extraído (de un .zip o subido suelto). */
export interface TextFile {
  path: string;
  text: string;
}

export interface Comparison {
  followers: Map<string, Account>;
  following: Map<string, Account>;
  /** Sigues y no te siguen. */
  notFollowingBack: Account[];
  /** Te siguen y no sigues. */
  fans: Account[];
  /** Os seguís mutuamente. */
  mutual: Account[];
  /** % de seguidos que te siguen de vuelta (0-100). */
  followBackRate: number;
}
