import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

interface PlaylistItem {
  id: number;
  type: 'image' | 'video' | 'web' | 'stream' | 'menu';
  url: string;
  duration: number;
  order_index: number;
  loop?: boolean;
  layout_config?: string;
}

interface MenuData {
  title: string;
  content: {
    dishes: {
      id: string;
      name: string;
      ingredients: string;
      image: string;
    }[];
  };
}

// Composant pour afficher un menu
const MenuView = ({ menuId, layoutConfig }: { menuId: string, layoutConfig?: string }) => {
  const [menu, setMenu] = useState<MenuData | null>(null);

  useEffect(() => {
    fetch(`/api/menus/${menuId}`)
      .then(res => res.json())
      .then(data => {
        const content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
        setMenu({ ...data, content });
      })
      .catch(err => console.error('Failed to fetch menu', err));
  }, [menuId]);

  if (!menu) return <div className="flex items-center justify-center h-full text-white">Chargement du menu...</div>;

  let dishesToDisplay = menu.content.dishes || [];
  if (layoutConfig) {
    try {
      const config = JSON.parse(layoutConfig);
      if (config.dishIds && config.dishIds.length > 0) {
        dishesToDisplay = dishesToDisplay.filter(d => config.dishIds.includes(d.id));
      }
    } catch (e) {}
  }

  return (
    <div className="h-full w-full bg-zinc-950 flex flex-col items-center overflow-hidden animate-fade-in relative">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-900/20 to-transparent"></div>
      
      <div className="z-10 w-full max-w-7xl px-12 py-16 flex flex-col h-full">
        <div className="flex items-center justify-between mb-16 border-b border-white/10 pb-8">
          <div>
            <h1 className="text-7xl font-black text-white uppercase tracking-tighter italic leading-none">
              {menu.title}
            </h1>
            <div className="h-2 w-32 bg-indigo-600 mt-4"></div>
          </div>
          <div className="text-right">
            <span className="text-zinc-500 text-sm font-bold uppercase tracking-[0.3em]">Lalo's Selection</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 overflow-y-auto pr-4 custom-scrollbar">
          {dishesToDisplay.map((dish) => (
            <div key={dish.id} className="bg-white/5 rounded-3xl border border-white/10 p-6 flex flex-col gap-6 hover:bg-white/10 transition-colors">
              {dish.image && (
                <div className="aspect-[16/10] rounded-2xl overflow-hidden border border-white/10">
                  <img src={dish.image} className="w-full h-full object-cover" alt={dish.name} />
                </div>
              )}
              <div className="space-y-3">
                <h2 className="text-3xl font-black text-white uppercase tracking-tight leading-tight">
                  {dish.name}
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed font-medium italic">
                  {dish.ingredients}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-12 flex justify-between items-center text-zinc-600 text-[10px] font-bold uppercase tracking-[0.4em]">
          <span>Freshly Prepared Daily</span>
          <div className="flex gap-4">
            <span>Organic</span>
            <span>Local</span>
            <span>Handmade</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface PlayerConfig {
  loop_playlist: boolean;
}

// Composant pour encapsuler Video.js
const VideoJS = (props: any) => {
  const videoRef = React.useRef<any>(null);
  const playerRef = React.useRef<any>(null);
  const { options, onReady } = props;

  React.useEffect(() => {
    if (!playerRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, options, () => {
        onReady && onReady(player);
      });
    } else {
      const player = playerRef.current;
      player.autoplay(options.autoplay);
      player.src(options.sources);
    }
  }, [options, videoRef]);

  React.useEffect(() => {
    const player = playerRef.current;
    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [playerRef]);

  return (
    <div data-vjs-player className="w-full h-full">
      <div ref={videoRef} className="w-full h-full" />
    </div>
  );
}

export default function Player() {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [config, setConfig] = useState<PlayerConfig>({ loop_playlist: true });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const searchParams = new URLSearchParams(window.location.search);
  const screenId = searchParams.get('screenId') || 'default';

  // Récupération de la playlist et de la configuration de l'écran
  const fetchPlaylist = async () => {
    try {
      const res = await fetch(`/api/playlist?screenId=${screenId}`);
      const data = await res.json();
      // On s'attend à recevoir { items: [], config: { loop_playlist: boolean } }
      setPlaylist(data.items || data); // Fallback si ta route renvoie directement l'array
      if (data.config) {
        setConfig(data.config);
      }
    } catch (err) {
      console.error('Failed to fetch playlist', err);
    }
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => {
      const nextIdx = prev + 1;
      
      // Si on arrive à la fin de la liste
      if (nextIdx >= playlist.length) {
        // Si la boucle globale est activée, on repart à 0, sinon on reste bloqué au dernier
        return config.loop_playlist ? 0 : prev;
      }
      return nextIdx;
    });
  };

  useEffect(() => {
    fetchPlaylist();

    // Connexion Socket.io pour les mises à jour en direct
    const socket = io({
      query: { screenId }
    });

    socket.on('playlist_updated', () => {
      fetchPlaylist();
    });

    socket.on('reload_player', () => {
      window.location.reload();
    });

    socket.on('next_slide', () => {
      nextSlide();
    });

    return () => {
      socket.disconnect();
    };
  }, [screenId]);

  useEffect(() => {
    // Ne rien faire si le player n'est pas démarré ou si la liste est vide
    if (!started || playlist.length === 0) return;

    const currentItem = playlist[currentIndex];
    
    // NETTOYAGE : On annule tout timer précédent
    if (timerRef.current) clearTimeout(timerRef.current);

    // LOGIQUE DE BOUCLE :
    // 1. Si l'item individuel est en "loop", on ne met pas de timer (il reste à l'écran indéfiniment)
    if (currentItem.loop) return;

    // 2. Si on est sur le dernier item et que la playlist ne boucle pas, on s'arrête là
    if (currentIndex === playlist.length - 1 && !config.loop_playlist) return;

    // 3. Sinon, on programme le passage au suivant selon la durée définie (uniquement pour images et web)
    if (currentItem.type !== 'video' && currentItem.type !== 'stream') {
      timerRef.current = setTimeout(() => {
        nextSlide();
      }, currentItem.duration * 1000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, started, playlist, config.loop_playlist]);

  // Écran d'attente si aucune donnée n'est disponible
  if (playlist.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900 text-white font-mono text-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p>Chargement de la playlist pour l'écran : {screenId}</p>
        </div>
      </div>
    );
  }

  // Écran de démarrage (évite les problèmes d'autoplay vidéo sans interaction)
  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-8">
        <h1 className="text-4xl font-black mb-8 tracking-tighter uppercase italic">Kiosk Player</h1>
        <button 
          onClick={() => setStarted(true)}
          className="group relative px-12 py-6 bg-white text-black rounded-full text-2xl font-black transition-all hover:scale-110 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
        >
          DÉMARRER LA DIFFUSION
        </button>
        <p className="mt-8 text-zinc-500 text-sm">Identifiant : {screenId}</p>
      </div>
    );
  }

  const currentItem = playlist[currentIndex];

  // Parsing de la configuration de mise en page
  let layoutStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0
  };

  if (currentItem.type === 'stream' && currentItem.layout_config) {
    try {
      const config = JSON.parse(currentItem.layout_config);
      if (config.mode === 'center') {
        layoutStyle = {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '80%',
          height: '80%'
        };
      } else if (config.mode === 'custom') {
        layoutStyle = {
          position: 'absolute',
          top: `${config.top}%`,
          left: `${config.left}%`,
          width: `${config.width}%`,
          height: `${config.height}%`
        };
      }
    } catch (e) {
      console.error('Failed to parse layout config', e);
    }
  }

  // Gestion spécifique pour YouTube
  const isYouTube = currentItem.type === 'web' && (currentItem.url.includes('youtube.com') || currentItem.url.includes('youtu.be'));
  let finalWebUrl = currentItem.url;
  
  if (isYouTube && currentItem.loop) {
    const videoId = currentItem.url.split('/').pop()?.split('?')[0];
    finalWebUrl += `${finalWebUrl.includes('?') ? '&' : '?'}playlist=${videoId}&loop=1&autoplay=1&mute=1`;
  }

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {/* AFFICHAGE IMAGE */}
      {currentItem.type === 'image' && (
        <div 
          key={currentItem.id + '-' + currentIndex}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-fade-in"
          style={{ backgroundImage: `url(${currentItem.url})` }}
        />
      )}

      {/* AFFICHAGE VIDÉO */}
      {currentItem.type === 'video' && (
        <video
          key={currentItem.id + '-' + currentIndex}
          src={currentItem.url}
          className="absolute inset-0 w-full h-full object-cover animate-fade-in"
          autoPlay
          muted
          playsInline
          loop={currentItem.loop}
          onEnded={() => {
            // Si la vidéo ne boucle pas sur elle-même, on force le passage au suivant dès qu'elle finit
            if (!currentItem.loop) nextSlide();
          }}
          onError={nextSlide}
        />
      )}

      {/* AFFICHAGE SITE WEB / IFRAME */}
      {currentItem.type === 'web' && (
        <div className="absolute inset-0 w-full h-full bg-white">
          <iframe
            key={currentItem.id + '-' + currentIndex}
            src={finalWebUrl}
            className="w-full h-full border-0 animate-fade-in"
            title="Signage Web Content"
            allow="autoplay; fullscreen"
          />
          {/* Indicateur discret en mode debug ou admin */}
          <div className="absolute bottom-4 right-4 bg-black/50 text-white text-[10px] px-2 py-1 rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            {currentItem.loop ? '∞ Loop Mode' : `Durée : ${currentItem.duration}s`}
          </div>
        </div>
      )}

      {/* AFFICHAGE STREAM (HLS/DASH) */}
      {currentItem.type === 'stream' && (
        <div 
          key={currentItem.id + '-' + currentIndex} 
          className="bg-black animate-fade-in"
          style={layoutStyle}
        >
          <VideoJS 
            options={{
              autoplay: true,
              controls: false,
              responsive: true,
              fluid: false,
              muted: true,
              sources: [{
                src: currentItem.url,
                type: currentItem.url.includes('.mpd') ? 'application/dash+xml' : 'application/x-mpegURL'
              }]
            }}
            onReady={(player: any) => {
              player.on('error', () => {
                console.error('Stream error, skipping...');
                nextSlide();
              });
            }}
          />
        </div>
      )}

      {/* AFFICHAGE MENU */}
      {currentItem.type === 'menu' && (
        <div key={currentItem.id + '-' + currentIndex} className="absolute inset-0 w-full h-full">
          <MenuView 
            menuId={currentItem.url} 
            layoutConfig={currentItem.layout_config} 
          />
        </div>
      )}
    </div>
  );
}