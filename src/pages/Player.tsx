import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  background?: string;
  accentColor?: string;
  content: {
    categories: {
      id: string;
      name: string;
      dishes: {
        id: string;
        name: string;
        ingredients: string[];
        image: string;
      }[];
    }[];
  };
}

// Composant pour afficher un menu
const MenuView = ({ menuId, layoutConfig }: { menuId: string, layoutConfig?: string }) => {
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const navRef = useRef<HTMLDivElement>(null);
  const cycleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const filteredCategories = useMemo(() => {
    if (!menu) return [];
    return (menu.content.categories || []).map(cat => {
      if (layoutConfig) {
        try {
          const config = JSON.parse(layoutConfig);
          if (config.dishIds && config.dishIds.length > 0) {
            return {
              ...cat,
              dishes: cat.dishes.filter(d => config.dishIds.includes(d.id))
            };
          }
        } catch (e) {}
      }
      return cat;
    }).filter(cat => cat.dishes.length > 0);
  }, [menu, layoutConfig]);

  useEffect(() => {
    fetch(`/api/menus/${menuId}`)
      .then(res => res.json())
      .then(data => {
        const content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
        
        // Migration to categories if needed
        if (content.dishes && !content.categories) {
          content.categories = [{
            id: 'default',
            name: 'Plats',
            dishes: content.dishes
          }];
        }
        
        setMenu({ ...data, content });
      })
      .catch(err => console.error('Failed to fetch menu', err));
  }, [menuId]);

  // Auto-cycle categories
  useEffect(() => {
    if (filteredCategories.length <= 1) return;

    cycleTimerRef.current = setInterval(() => {
      setActiveCategoryIdx(prev => (prev + 1) % filteredCategories.length);
    }, 8000); // Cycle every 8 seconds

    return () => {
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
    };
  }, [filteredCategories]);

  // Update highlight position
  useEffect(() => {
    if (!navRef.current) return;
    const buttons = navRef.current.querySelectorAll('.menu-button');
    const activeButton = buttons[activeCategoryIdx] as HTMLElement;
    if (activeButton) {
      setHighlightStyle({
        width: `${activeButton.offsetWidth}px`,
        height: `${activeButton.offsetHeight}px`,
        left: `${activeButton.offsetLeft}px`,
        top: `${activeButton.offsetTop}px`,
        position: 'absolute',
        borderRadius: '3px',
        zIndex: 0,
        transition: 'all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.15)',
        pointerEvents: 'none',
        backgroundColor: menu?.accentColor || '#ffc600'
      });
    }
  }, [activeCategoryIdx, menu]);

  if (!menu) return <div className="flex items-center justify-center h-full text-white">Chargement du menu...</div>;

  const activeCategory = filteredCategories[activeCategoryIdx >= filteredCategories.length ? 0 : activeCategoryIdx];
  const accentColor = menu.accentColor || '#ffc600';

  return (
    <div 
      className="h-full w-full flex flex-col items-center overflow-hidden animate-fade-in relative"
      style={{
        background: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url(${menu.background || "https://i.imgur.com/er8DtBW.jpg"}) center/cover no-repeat fixed`,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div className="w-full max-w-5xl px-8 py-16 flex flex-col h-full">
        <div className="mb-4">
          <h2 
            className="inline-block border-b-4 leading-none mb-4"
            style={{ 
              borderColor: accentColor,
              font: "50px 'Cookie', cursive"
            }}
          >
            {menu.title}
          </h2>
        </div>

        {/* Navigation */}
        {filteredCategories.length > 1 && (
          <nav ref={navRef} className="flex justify-center flex-wrap mb-12 relative gap-3">
            <div style={highlightStyle}></div>
            {filteredCategories.map((cat, idx) => (
              <button
                key={cat.id}
                className="menu-button px-5 py-2.5 border rounded-sm text-white font-bold uppercase tracking-widest text-xs transition-colors relative z-10"
                style={{ borderColor: accentColor }}
                onClick={() => setActiveCategoryIdx(idx)}
              >
                {cat.name}
              </button>
            ))}
          </nav>
        )}

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-20 gap-y-10 overflow-y-auto pr-4 custom-scrollbar">
          {activeCategory?.dishes.map((dish) => (
            <div key={dish.id} className="flex flex-col animate-fade-in">
              <div className="flex items-baseline gap-4">
                <h3 
                  className="text-4xl leading-none m-0 whitespace-nowrap"
                  style={{ color: accentColor, font: "35px 'Cookie', cursive" }}
                >
                  {dish.name}
                </h3>
                <div className="flex-1 border-b border-white/20 border-dotted mb-1"></div>
              </div>
              <p className="mt-2 text-sm leading-relaxed opacity-90 font-medium">
                {Array.isArray(dish.ingredients) ? dish.ingredients.join(', ') : dish.ingredients}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-12 flex justify-between items-center text-white/40 text-[10px] font-bold uppercase tracking-[0.4em]">
          <span>Lalo's Kiosk Digital Signage</span>
          <div className="flex gap-4">
            <span>Fresh</span>
            <span>Local</span>
            <span>Daily</span>
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