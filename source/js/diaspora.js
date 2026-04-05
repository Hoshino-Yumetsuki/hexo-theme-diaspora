const Home = window.location.href;

let activeRequestController = null;
let activeRequestUrl = "";
let activeParallax = null;
let typedInstance = null;
let searchEntriesPromise = null;

const Diaspora = {
  request(url, onSuccess, onAbort) {
    if (!url || url === activeRequestUrl) {
      return false;
    }

    activeRequestUrl = url;

    if (activeRequestController) {
      activeRequestController.abort();
    }

    const controller = new AbortController();
    activeRequestController = controller;

    fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "X-Requested-With": "fetch",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }
        return response.text();
      })
      .then((html) => {
        if (controller.signal.aborted) {
          return;
        }
        onSuccess(html);
      })
      .catch((error) => {
        if (controller.signal.aborted || error.name === "AbortError") {
          if (typeof onAbort === "function") {
            onAbort();
          }
          return;
        }

        window.location.href = url;
      })
      .finally(() => {
        if (activeRequestController === controller) {
          activeRequestController = null;
          activeRequestUrl = "";
        }
      });

    return true;
  },

  isTouch() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  },

  parseHTML(html) {
    return new DOMParser().parseFromString(html, "text/html");
  },

  setDocumentLoading(isLoading) {
    document.body.classList.toggle("loading", isLoading);
  },

  loading() {
    Diaspora.setDocumentLoading(true);
  },

  loaded() {
    Diaspora.setDocumentLoading(false);
  },

  qs(selector, root = document) {
    return root.querySelector(selector);
  },

  qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  },

  extractSingleFromHTML(html) {
    const doc = Diaspora.parseHTML(html);
    return {
      doc,
      single: doc.querySelector("#single"),
    };
  },

  getPreview() {
    return Diaspora.qs("#preview");
  },

  getContainer() {
    return Diaspora.qs("#container");
  },

  syncScrollState(scrollTop) {
    const container = Diaspora.getContainer();
    if (!container) {
      return;
    }
    container.dataset.scroll = String(scrollTop);
  },

  waitForTransitionEnd(element, callback, fallback = 350) {
    if (!element) {
      callback();
      return;
    }

    let handled = false;
    const finish = () => {
      if (handled) {
        return;
      }
      handled = true;
      element.removeEventListener("transitionend", onTransitionEnd);
      callback();
    };
    const onTransitionEnd = (event) => {
      if (event.target === element) {
        finish();
      }
    };

    element.addEventListener("transitionend", onTransitionEnd);
    window.setTimeout(finish, fallback);
  },

  pushStateForHome() {
    if (!(window.history && window.history.pushState)) {
      return;
    }

    window.history.replaceState(
      { u: Home, t: document.title },
      document.title,
      Home
    );

    window.addEventListener("popstate", (event) => {
      const state = event.state;
      if (!state) {
        return;
      }

      document.title = state.t || document.title;

      if (state.u === Home) {
        const preview = Diaspora.getPreview();
        const container = Diaspora.getContainer();
        if (!preview || !container) {
          window.location.href = Home;
          return;
        }

        preview.style.position = "fixed";
        preview.style.overflowY = "scroll";

        window.setTimeout(() => {
          preview.classList.remove("show");
          container.style.display = "block";

          const scrollTarget = Number.parseInt(container.dataset.scroll || "0", 10) || 0;
          window.scrollTo(0, scrollTarget);

          Diaspora.waitForTransitionEnd(preview, () => {
            preview.innerHTML = "";
            preview.style.overflowY = "scroll";
            window.dispatchEvent(new Event("resize"));
            Diaspora.loaded();
          }, 500);
        }, 0);

        return;
      }

      Diaspora.loading();
      Diaspora.request(state.u, (html) => {
        const { single } = Diaspora.extractSingleFromHTML(html);
        if (!single) {
          window.location.href = state.u;
          return;
        }

        const preview = Diaspora.getPreview();
        if (!preview) {
          window.location.href = state.u;
          return;
        }

        preview.innerHTML = "";
        preview.append(single);
        Diaspora.preview();
        window.setTimeout(() => {
          Diaspora.player();
          Diaspora.initComments();
        }, 0);
      });
    });
  },

  historySwitch(anchor, mode) {
    const preview = Diaspora.getPreview();
    const titleRoot = Diaspora.qs("#config-title");
    const href = anchor?.getAttribute("href");
    const pageTitle = anchor?.getAttribute("title") || anchor?.textContent?.trim() || document.title;
    const title = `${pageTitle} - ${titleRoot ? titleRoot.textContent.trim() : document.title}`;

    if (!preview || !(window.history && window.history.pushState) || !href) {
      if (href) {
        window.location.href = href;
      }
      return;
    }

    Diaspora.loading();

    const state = {
      d: Number(anchor.dataset.id || 0),
      t: title,
      u: href,
    };

    Diaspora.request(href, (html) => {
      const { single } = Diaspora.extractSingleFromHTML(html);
      if (!single) {
        window.location.href = href;
        return;
      }

      if (mode === "push") {
        window.history.pushState(state, title, href);
      }
      if (mode === "replace") {
        window.history.replaceState(state, title, href);
      }

      document.title = title;
      preview.innerHTML = "";
      preview.append(single);

      if (mode === "push") {
        Diaspora.preview();
      } else {
        window.scrollTo(0, 0);
        Diaspora.loaded();
      }

      window.setTimeout(() => {
        Diaspora.player();

        const top = Diaspora.qs("#top");
        if (top) {
          top.style.display = "block";
        }

        Diaspora.initComments();

        const gitalkContainer = Diaspora.qs("#gitalk-container");
        if (gitalkContainer && gitalkContainer.dataset.ae === "true") {
          gitalkContainer.click();
        }
      }, 0);

      if (window.MathJax && window.MathJax.Hub) {
        const mathRoot = document.getElementById("single");
        window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, mathRoot]);
      }
    });
  },

  preview() {
    const preview = Diaspora.getPreview();
    const container = Diaspora.getContainer();

    if (!preview || !container) {
      Diaspora.loaded();
      return;
    }

    Diaspora.waitForTransitionEnd(preview, () => {
      const previewVisible = preview.classList.contains("show");
      container.style.display = previewVisible ? "none" : "block";
      Diaspora.loaded();
    }, 500);

    window.setTimeout(() => {
      preview.classList.add("show");
      Diaspora.syncScrollState(window.scrollY);

      window.setTimeout(() => {
        preview.style.position = "static";
        preview.style.overflowY = "auto";
      }, 500);
    }, 0);
  },

  player() {
    const player = Diaspora.qs("#audio");
    const playIcons = Diaspora.qsa(".icon-play");

    if (!player) {
      playIcons.forEach((icon) => {
        icon.style.color = "#dedede";
        icon.style.cursor = "not-allowed";
      });
      return;
    }

    const source = Diaspora.qs("source", player);
    const sourceSrc = source?.getAttribute("src") || "";
    if (!sourceSrc && !player.getAttribute("src")) {
      const audioList = Diaspora.qsa("#audio-list li");
      if (audioList.length > 0) {
        const randomTrack = audioList[Math.floor(Math.random() * audioList.length)];
        player.src = randomTrack.dataset.url || "";
      }
    }

    if (player.dataset.autoplay === "true") {
      player.play().catch(() => {});
    }

    if (player.dataset.boundEvents === "true") {
      return;
    }
    player.dataset.boundEvents = "true";

    player.addEventListener("timeupdate", () => {
      const progressBar = Diaspora.qs(".bar");
      if (!Number.isFinite(player.duration) || player.duration <= 0 || !progressBar) {
        return;
      }

      const progress = (player.currentTime / player.duration) * 100;
      progressBar.style.width = `${progress}%`;
      player.volume = progress / 5 <= 1 ? progress / 5 : 1;
    });

    player.addEventListener("ended", () => {
      Diaspora.qsa(".icon-pause").forEach((icon) => {
        icon.classList.remove("icon-pause");
        icon.classList.add("icon-play");
      });
    });

    player.addEventListener("playing", () => {
      Diaspora.qsa(".icon-play").forEach((icon) => {
        icon.classList.remove("icon-play");
        icon.classList.add("icon-pause");
      });
    });
  },

  fitImageToParent(image, width, height) {
    if (!image || !image.parentElement || !width || !height) {
      return;
    }

    const parentHeight = image.parentElement.clientHeight;
    const parentWidth = image.parentElement.clientWidth;
    const ratio = height / width;

    if (parentHeight / parentWidth > ratio) {
      image.style.height = `${parentHeight}px`;
      image.style.width = `${parentHeight / ratio}px`;
    } else {
      image.style.width = `${parentWidth}px`;
      image.style.height = `${parentWidth * ratio}px`;
    }

    image.style.left = `${(parentWidth - Number.parseInt(image.style.width, 10)) / 2}px`;
    image.style.top = `${(parentHeight - Number.parseInt(image.style.height, 10)) / 2}px`;
  },

  initializeCover() {
    const preview = Diaspora.getPreview();
    const cover = Diaspora.qs("#cover");
    const mark = Diaspora.qs("#mark");
    const layer = Diaspora.qs(".layer");

    if (!preview || !cover || !mark || !layer) {
      return;
    }

    const state = {
      width: Number.parseFloat(cover.getAttribute("width") || "0"),
      height: Number.parseFloat(cover.getAttribute("height") || "0"),
    };

    const syncMarkHeight = () => {
      mark.style.height = `${window.innerHeight}px`;
      preview.style.minHeight = `${window.innerHeight}px`;
    };

    const syncCoverLayout = () => {
      const markWidth = mark.clientWidth;
      const markHeight = mark.clientHeight;
      let x;
      let y;
      let i;
      const edge = markWidth >= 1000 || markHeight >= 1000 ? 1000 : 500;

      if (markWidth >= markHeight) {
        i = (markWidth / edge) * 50;
        y = i;
        x = (i * markWidth) / markHeight;
      } else {
        i = (markHeight / edge) * 50;
        x = i;
        y = (i * markHeight) / markWidth;
      }

      layer.style.width = `${markWidth + x}px`;
      layer.style.height = `${markHeight + y}px`;
      layer.style.marginLeft = `${-0.5 * x}px`;
      layer.style.marginTop = `${-0.5 * y}px`;

      if (!state.width || !state.height) {
        state.width = cover.naturalWidth || cover.width;
        state.height = cover.naturalHeight || cover.height;
      }

      Diaspora.fitImageToParent(cover, state.width, state.height);
    };

    const initializeParallax = () => {
      if (activeParallax || Diaspora.isTouch() || window.location.href !== Home) {
        return;
      }

      if (typeof window.Parallax !== "function") {
        return;
      }

      activeParallax = new window.Parallax(mark, {
        relativeInput: true,
        hoverOnly: true,
        calibrateX: false,
        calibrateY: true,
        limitX: 30,
        limitY: 30,
        scalarX: 5,
        scalarY: 5,
        frictionX: 0.1,
        frictionY: 0.1,
      });
    };

    const initializeVibrant = () => {
      if (!window.Vibrant || typeof window.Vibrant.from !== "function") {
        return;
      }

      window.Vibrant.from(cover)
        .getPalette()
        .then((palette) => {
          if (palette.DarkVibrant) {
            Diaspora.qsa("#vibrant polygon").forEach((polygon) => {
              polygon.style.fill = palette.DarkVibrant.hex;
            });
            Diaspora.qsa("#vibrant div").forEach((element) => {
              element.style.backgroundColor = palette.DarkVibrant.hex;
            });
          }
          if (palette.Vibrant) {
            Diaspora.qsa(".icon-menu, .icon-search").forEach((icon) => {
              icon.style.color = palette.Vibrant.hex;
            });
          }
        })
        .catch(() => {});
    };

    const onCoverReady = () => {
      syncMarkHeight();
      syncCoverLayout();
      initializeParallax();
      initializeVibrant();

      window.setTimeout(() => {
        document.documentElement.classList.remove("loading");
        document.body.classList.remove("loading");
      }, 1000);
    };

    syncMarkHeight();

    if (!cover.getAttribute("src")) {
      window.alert("Please set the post thumbnail");
    }

    if (cover.complete) {
      window.setTimeout(onCoverReady, 0);
    } else {
      cover.addEventListener("load", onCoverReady, { once: true });
    }

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!Diaspora.isTouch() && window.location.href === Home) {
          syncMarkHeight();
          syncCoverLayout();
        }
        if (Diaspora.qs("#loader")?.getAttribute("class")) {
          Diaspora.loading();
        }
      }, 500);
    });

    Diaspora.pushStateForHome();
  },

  initializeStandaloneSingle() {
    const single = Diaspora.qs("#single");
    if (single) {
      single.style.minHeight = `${window.innerHeight}px`;
    }

    window.setTimeout(() => {
      document.documentElement.classList.remove("loading");
      document.body.classList.remove("loading");
    }, 1000);

    window.addEventListener("popstate", (event) => {
      if (event.state?.u) {
        window.location.href = event.state.u;
      }
    });

    Diaspora.player();

    Diaspora.qsa(".icon-icon, .image-icon").forEach((link) => {
      if (link instanceof HTMLAnchorElement) {
        link.setAttribute("href", "/");
      }
    });

    const top = Diaspora.qs("#top");
    if (top) {
      top.style.display = "block";
    }
  },

  initializeSearch(path, searchId, contentId) {
    const input = document.getElementById(searchId);
    const resultRoot = document.getElementById(contentId);

    if (!input || !resultRoot) {
      return;
    }

    if (!searchEntriesPromise) {
      searchEntriesPromise = fetch(path)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Search index request failed: ${response.status}`);
          }
          return response.text();
        })
        .then((xml) => new DOMParser().parseFromString(xml, "text/xml"))
        .then((xmlDoc) => {
          return Array.from(xmlDoc.querySelectorAll("entry")).map((entry) => ({
            title: entry.querySelector("title")?.textContent || "",
            content: entry.querySelector("content")?.textContent || "",
            url: entry.querySelector("url")?.textContent || "",
          }));
        })
        .catch(() => []);
    }

    if (input.dataset.searchBound === "true") {
      return;
    }
    input.dataset.searchBound = "true";

    input.addEventListener("input", async function onInput() {
      const entries = await searchEntriesPromise;
      const rawValue = input.value.trim();
      resultRoot.innerHTML = "";

      if (!rawValue.length) {
        return;
      }

      const keywords = rawValue.toLowerCase().split(/[\s\-]+/).filter(Boolean);
      const fragments = [];

      entries.forEach((entry) => {
        let isMatch = true;
        let firstOccur = -1;
        const title = entry.title.trim().toLowerCase();
        const content = entry.content.trim().replace(/<[^>]+>/g, "").toLowerCase();

        if (title && content) {
          keywords.forEach((keyword, index) => {
            const titleIndex = title.indexOf(keyword);
            let contentIndex = content.indexOf(keyword);

            if (titleIndex < 0 && contentIndex < 0) {
              isMatch = false;
              return;
            }

            if (contentIndex < 0) {
              contentIndex = 0;
            }
            if (index === 0) {
              firstOccur = contentIndex;
            }
          });
        } else {
          isMatch = false;
        }

        if (!isMatch) {
          return;
        }

        let item = `<li><a href="${entry.url}" class="search-result-title" target="_blank">${title}</a>`;
        const cleanContent = entry.content.trim().replace(/<[^>]+>/g, "");

        if (firstOccur >= 0) {
          let start = firstOccur - 6;
          let end = firstOccur + 6;

          if (start < 0) {
            start = 0;
          }
          if (start === 0) {
            end = 10;
          }
          if (end > cleanContent.length) {
            end = cleanContent.length;
          }

          let matchContent = cleanContent.substring(start, end);
          keywords.forEach((keyword) => {
            const regex = new RegExp(keyword, "gi");
            matchContent = matchContent.replace(regex, `<em class="search-keyword">${keyword}</em>`);
          });

          item += `<p class="search-result">${matchContent}...</p>`;
        }

        item += "</li>";
        fragments.push(item);
      });

      resultRoot.innerHTML = `<ul class="search-result-list">${fragments.join("")}</ul>`;
    });
  },

  fade(element, visible) {
    if (!element) {
      return;
    }

    if (visible) {
      element.style.display = "block";
      window.requestAnimationFrame(() => {
        element.style.opacity = "1";
      });
      return;
    }

    element.style.opacity = "0";
    window.setTimeout(() => {
      if (element.style.opacity === "0") {
        element.style.display = "none";
      }
    }, 300);
  },

  smoothScrollTo(targetTop, duration = 300) {
    const startTop = window.scrollY;
    const distance = targetTop - startTop;
    const startTime = performance.now();

    const tick = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      window.scrollTo(0, startTop + distance * eased);

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      }
    };

    window.requestAnimationFrame(tick);
  },

  handleLoadMore(anchor) {
    if (!anchor || anchor.dataset.status === "loading") {
      return;
    }

    const href = anchor.getAttribute("href");
    if (!href) {
      return;
    }

    anchor.textContent = "加载中...";
    anchor.dataset.status = "loading";
    Diaspora.loading();

    Diaspora.request(
      href,
      (html) => {
        const doc = Diaspora.parseHTML(html);
        const nextLink = doc.querySelector("#pager .more");
        const primary = Diaspora.qs("#primary");

        if (!primary) {
          window.location.href = href;
          return;
        }

        const tempScrollTop = window.scrollY;
        const posts = Array.from(doc.querySelectorAll("#primary .post"));
        posts.forEach((post) => {
          primary.append(post);
        });

        if (nextLink?.getAttribute("href")) {
          anchor.setAttribute("href", nextLink.getAttribute("href"));
          anchor.textContent = "加载更多";
          anchor.dataset.status = "loaded";
        } else {
          Diaspora.qs("#pager")?.remove();
        }

        window.scrollTo(0, tempScrollTop + 100);
        Diaspora.loaded();
        Diaspora.smoothScrollTo(tempScrollTop + 400, 500);
      },
      () => {
        anchor.textContent = "加载更多";
        anchor.dataset.status = "loaded";
        Diaspora.loaded();
      }
    );
  },

  toggleMenu() {
    const html = document.documentElement;
    const body = document.body;

    html.classList.toggle("mu");
    body.classList.toggle("mu");

    if (typedInstance) {
      typedInstance.destroy();
      typedInstance = null;
      return;
    }

    const hitokoto = Diaspora.qs("#hitokoto");
    if (!hitokoto || hitokoto.dataset.st !== "true" || typeof window.Typed !== "function") {
      return;
    }

    fetch("https://v1.hitokoto.cn/")
      .then((response) => response.json())
      .then((data) => {
        const message = `${data.hitokoto} ——  By ${data.from}`;
        typedInstance = new window.Typed(".hitokoto .typed", {
          strings: [message],
          typeSpeed: 90,
          startDelay: 500,
        });
      })
      .catch(() => {});
  },

  toggleSearch(target) {
    document.body.classList.remove("mu");
    document.documentElement.classList.remove("mu");

    if (typedInstance) {
      typedInstance.destroy();
      typedInstance = null;
    }

    window.setTimeout(() => {
      Diaspora.historySwitch(target, "push");
      Diaspora.fade(Diaspora.qs(".toc"), true);
      Diaspora.initializeSearch(window.searchDbPath || "/search.xml", "local-search-input", "local-search-result");
    }, 300);
  },

  ensureQRCode() {
    const qrRoot = Diaspora.qs("#qr");
    if (!qrRoot) {
      return;
    }

    if (qrRoot.dataset.rendered === "true") {
      qrRoot.style.display = qrRoot.style.display === "block" ? "none" : "block";
      return;
    }

    const scanIcon = Diaspora.qs(".icon-scan");
    scanIcon?.classList.add("tg");

    try {
      const image = document.createElement("img");
      image.width = 128;
      image.height = 128;
      image.alt = "QR code";
      image.src = `https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(window.location.href)}`;
      qrRoot.innerHTML = "";
      qrRoot.append(image);
      qrRoot.dataset.rendered = "true";
      qrRoot.style.display = "block";
    } catch (error) {
      qrRoot.textContent = "当前页面链接：";
      const link = document.createElement("a");
      link.href = window.location.href;
      link.textContent = window.location.href;
      link.target = "_blank";
      qrRoot.append(link);
      qrRoot.dataset.rendered = "true";
      qrRoot.style.display = "block";
    }
  },

  toggleAudio(play) {
    const audio = Diaspora.qs("#audio");
    if (!audio) {
      return;
    }

    if (play) {
      audio.play().catch(() => {});
      Diaspora.qsa(".icon-play").forEach((icon) => {
        icon.classList.remove("icon-play");
        icon.classList.add("icon-pause");
      });
      return;
    }

    audio.pause();
    Diaspora.qsa(".icon-pause").forEach((icon) => {
      icon.classList.remove("icon-pause");
      icon.classList.add("icon-play");
    });
  },

  openPhotoSwipe(clickedImage) {
    const pswpElement = Diaspora.qs(".pswp");
    if (!pswpElement || typeof window.PhotoSwipe !== "function") {
      return;
    }

    const images = Diaspora.qsa(".content img");
    let index = 0;
    const items = images.map((image, currentIndex) => {
      if (image.src === clickedImage.src) {
        index = currentIndex;
      }

      return {
        src: image.src,
        w: image.naturalWidth,
        h: image.naturalHeight,
      };
    });

    const lightBox = new window.PhotoSwipe(pswpElement, window.PhotoSwipeUI_Default, items, {
      index,
      shareEl: false,
      zoomEl: false,
      allowRotationOnUserZoom: true,
      history: false,
      getThumbBoundsFn(photoIndex) {
        const thumbnail = images[photoIndex];
        const pageYScroll = window.pageYOffset || document.documentElement.scrollTop;
        const rect = thumbnail.getBoundingClientRect();

        return { x: rect.left, y: rect.top + pageYScroll, w: rect.width };
      },
    });

    lightBox.init();
  },

  initializeComments() {
    const commentsContainer = Diaspora.qs("#comments-container");
    if (!commentsContainer) {
      return;
    }

    const gitalkContainer = commentsContainer.querySelector("#gitalk-container");
    if (gitalkContainer && gitalkContainer.dataset.rendered !== "true") {
      gitalkContainer.dataset.commentProvider = "gitalk";
    }

    const twikooContainer = commentsContainer.querySelector("#tcomment");
    if (twikooContainer && twikooContainer.dataset.rendered !== "true") {
      twikooContainer.dataset.commentProvider = "twikoo";
    }
  },

  renderComments() {
    const commentsContainer = Diaspora.qs("#comments-container");
    if (!commentsContainer) {
      return;
    }

    Diaspora.loading();

    const gitalkContainer = commentsContainer.querySelector("#gitalk-container");
    if (gitalkContainer) {
      if (gitalkContainer.dataset.rendered !== "true" && typeof window.Gitalk === "function") {
        const gitalk = new window.Gitalk({
          clientID: gitalkContainer.dataset.ci,
          clientSecret: gitalkContainer.dataset.cs,
          repo: gitalkContainer.dataset.r,
          owner: gitalkContainer.dataset.o,
          admin: JSON.parse(gitalkContainer.dataset.a || "[]"),
          id: decodeURI(window.location.pathname),
          distractionFreeMode: gitalkContainer.dataset.d === "true",
        });
        gitalk.render("gitalk-container");
        gitalkContainer.dataset.rendered = "true";
      }
    } else {
      const twikooContainer = commentsContainer.querySelector("#tcomment");
      if (twikooContainer && twikooContainer.dataset.rendered !== "true" && window.twikoo) {
        window.twikoo.init({
          envId: twikooContainer.dataset.e,
          el: "#tcomment",
          region: twikooContainer.dataset.r,
          visitor: twikooContainer.dataset.v === "true",
        });
        twikooContainer.dataset.rendered = "true";
      }
    }

    Diaspora.qsa(".comment").forEach((element) => {
      element.classList.remove("link");
    });
    Diaspora.loaded();
  },

  initComments() {
    const gitalkContainer = Diaspora.qs("#gitalk-container");
    if (gitalkContainer && gitalkContainer.dataset.ae === "true") {
      gitalkContainer.click();
    }

    const twikooContainer = Diaspora.qs("#tcomment");
    if (twikooContainer && twikooContainer.dataset.ae === "true") {
      twikooContainer.click();
    }
  },

  bindGlobalEvents() {
    window.addEventListener("scroll", () => {
      const scrollbar = Diaspora.qs(".scrollbar");
      const subtitle = Diaspora.qs(".subtitle");
      const top = Diaspora.qs("#top");
      const imageGalleryToggle = Diaspora.qs(".icon-images");
      const imagesActive = imageGalleryToggle?.classList.contains("active");

      if (scrollbar && !Diaspora.isTouch() && !imagesActive && top) {
        const wt = window.scrollY;
        const tw = top.clientWidth;
        const dh = document.body.scrollHeight;
        const wh = window.innerHeight;
        const width = ((tw / (dh - wh)) * wt) || 0;
        scrollbar.style.width = `${width}px`;

        if (subtitle) {
          Diaspora.fade(subtitle, wt > 80 && window.innerWidth > 800);
        }
      }
    });

    window.addEventListener(
      "touchmove",
      (event) => {
        if (document.body.classList.contains("mu")) {
          event.preventDefault();
        }
      },
      { passive: false }
    );

    document.body.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const clickedImage =
        target instanceof HTMLImageElement && target.closest("div.content") ? target : null;
      const actionable =
        target.closest("a, button, .iconfont, .switchmenu, .switchsearch, .more, .comment, .toc-text, .toc-link, .toc-number") ||
        clickedImage;

      if (!(actionable instanceof Element)) {
        return;
      }

      if (actionable.classList.contains("switchmenu")) {
        event.preventDefault();
        window.scrollTo(0, 0);
        Diaspora.toggleMenu();
        return;
      }

      if (actionable.classList.contains("switchsearch")) {
        event.preventDefault();
        Diaspora.toggleSearch(actionable);
        return;
      }

      if (actionable.classList.contains("more")) {
        event.preventDefault();
        Diaspora.handleLoadMore(actionable);
        return;
      }

      if (actionable.classList.contains("icon-home")) {
        event.preventDefault();
        Diaspora.fade(Diaspora.qs(".toc"), false);

        if (Diaspora.getPreview()?.classList.contains("show")) {
          window.history.back();
        } else {
          const url = actionable.getAttribute("data-url");
          if (url) {
            window.location.href = url;
          }
        }
        return;
      }

      if (actionable.classList.contains("icon-scan")) {
        event.preventDefault();
        Diaspora.ensureQRCode();
        return;
      }

      if (actionable.classList.contains("icon-play")) {
        event.preventDefault();
        Diaspora.toggleAudio(true);
        return;
      }

      if (actionable.classList.contains("icon-pause")) {
        event.preventDefault();
        Diaspora.toggleAudio(false);
        return;
      }

      if (actionable.id === "cover") {
        const parentAnchor = actionable.parentElement;
        if (parentAnchor instanceof HTMLAnchorElement) {
          event.preventDefault();
          Diaspora.historySwitch(parentAnchor, "push");
        }
        return;
      }

      if (actionable.classList.contains("posttitle") && actionable instanceof HTMLAnchorElement) {
        event.preventDefault();
        Diaspora.historySwitch(actionable, "push");
        return;
      }

      const rel = actionable.getAttribute("rel");
      if ((rel === "prev" || rel === "next") && actionable instanceof HTMLAnchorElement) {
        event.preventDefault();

        const siblings = Diaspora.qsa("#prev_next a");
        const index = rel === "prev" ? 0 : 1;
        const title = siblings[index]?.textContent?.trim();
        if (title) {
          actionable.setAttribute("title", title);
        }

        Diaspora.historySwitch(actionable, "replace");
        return;
      }

      if (
        actionable.classList.contains("toc-text") ||
        actionable.classList.contains("toc-link") ||
        actionable.classList.contains("toc-number")
      ) {
        event.preventDefault();
        const link = actionable instanceof HTMLAnchorElement ? actionable : actionable.parentElement;
        const hash = link?.getAttribute("href");
        if (!hash) {
          return;
        }

        const destination = Diaspora.qs(decodeURI(hash));
        if (destination) {
          Diaspora.smoothScrollTo(destination.getBoundingClientRect().top + window.scrollY - 50, 300);
        }
        return;
      }

      if (actionable.classList.contains("pviewa") && actionable instanceof HTMLAnchorElement) {
        event.preventDefault();
        document.body.classList.remove("mu");
        document.documentElement.classList.remove("mu");

        if (typedInstance) {
          typedInstance.destroy();
          typedInstance = null;
        }

        window.setTimeout(() => {
          Diaspora.historySwitch(actionable, "push");
          Diaspora.fade(Diaspora.qs(".toc"), true);
          Diaspora.initComments();
        }, 300);
        return;
      }

      if (clickedImage) {
        event.preventDefault();
        Diaspora.openPhotoSwipe(clickedImage);
        return;
      }

      if (actionable.classList.contains("comment")) {
        event.preventDefault();
        Diaspora.renderComments();
      }
    });
  },

  initializeQuickViewLinks() {
    Diaspora.qsa(".pview a").forEach((anchor) => {
      anchor.classList.add("pviewa");
    });
  },

  boot() {
    if (Diaspora.isTouch()) {
      document.body.classList.add("touch");
    }

    if (Diaspora.getPreview()) {
      Diaspora.initializeCover();
      Diaspora.initializeQuickViewLinks();
    } else {
      Diaspora.initializeStandaloneSingle();
    }

    Diaspora.initializeSearch(window.searchDbPath || "/search.xml", "local-search-input", "local-search-result");
    Diaspora.bindGlobalEvents();
    Diaspora.initializeComments();
    Diaspora.initComments();

    window.console.log(
      "%c Github %c",
      "background:#24272A; color:#ffffff",
      "",
      "https://github.com/Fechin/hexo-theme-diaspora"
    );
  },
};

document.addEventListener("DOMContentLoaded", () => {
  Diaspora.boot();
});
