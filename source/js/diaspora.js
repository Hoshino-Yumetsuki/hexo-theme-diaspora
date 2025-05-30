var Home = location.href,
  Pages = 4,
  xhr,
  xhrUrl = "";

var Diaspora = {
  L: function (url, f, err) {
    if (url == xhrUrl) {
      return false;
    }
    xhrUrl = url;
    if (xhr) {
      xhr.abort();
    }
    xhr = $.ajax({
      type: "GET",
      url: url,
      timeout: 10000,
      success: function (data) {
        f(data);
        xhrUrl = "";
      },
      error: function (a, b, c) {
        if (b == "abort") {
          err && err();
        } else {
          window.location.href = url;
        }
        xhrUrl = "";
      },
    });
  },
  P: function () {
    return !!("ontouchstart" in window);
  },
  PS: function () {
    if (!(window.history && history.pushState)) {
      return;
    }
    history.replaceState({ u: Home, t: document.title }, document.title, Home);
    window.addEventListener("popstate", function (e) {
      var state = e.state;
      if (!state) return;
      document.title = state.t;

      if (state.u == Home) {
        $("#preview").css("position", "fixed");
        setTimeout(function () {
          $("#preview").removeClass("show");
          $("#container").show();
          window.scrollTo(0, parseInt($("#container").data("scroll")));
          setTimeout(function () {
            $("#preview").html("");
            $(window).trigger("resize");
          }, 300);
        }, 0);
      } else {
        Diaspora.loading();
        Diaspora.L(state.u, function (data) {
          document.title = state.t;
          $("#preview").html($(data).filter("#single"));
          Diaspora.preview();
          setTimeout(function () {
            Diaspora.player();
          }, 0);
        });
      }
    });
  },
  HS: function (tag, flag) {
    var id = tag.data("id") || 0,
      url = tag.attr("href"),
      title = tag.attr("title") + " - " + $("#config-title").text();

    if (!$("#preview").length || !(window.history && history.pushState)) location.href = url;
    Diaspora.loading();
    var state = { d: id, t: title, u: url };
    Diaspora.L(url, function (data) {
      if (!$(data).filter("#single").length) {
        location.href = url;
        return;
      }
      switch (flag) {
        case "push":
          history.pushState(state, title, url);
          break;
        case "replace":
          history.replaceState(state, title, url);
          break;
      }
      document.title = title;
      $("#preview").html($(data).filter("#single"));
      switch (flag) {
        case "push":
          Diaspora.preview();
          break;
        case "replace":
          window.scrollTo(0, 0);
          Diaspora.loaded();
          break;
      }
      setTimeout(function () {
        Diaspora.player();
        $("#top").show();
        comment = $("#gitalk-container");
        if (comment.data("ae") == true) {
          comment.click();
        }
      }, 0);
      if (window.MathJax) {
        var math = document.getElementById("single");
        MathJax.Hub.Queue(["Typeset", MathJax.Hub, math]);
      }
    });
  },
  preview: function () {
    // preview toggle
    $("#preview").one("transitionend webkitTransitionEnd oTransitionEnd otransitionend MSTransitionEnd", function () {
      var previewVisible = $("#preview").hasClass("show");
      if (!!previewVisible) {
        $("#container").hide();
      } else {
        $("#container").show();
      }
      Diaspora.loaded();
    });
    setTimeout(function () {
      $("#preview").addClass("show");
      $("#container").data("scroll", window.scrollY);
      setTimeout(function () {
        $("#preview").css({
          position: "static",
          "overflow-y": "auto",
        });
      }, 500);
    }, 0);
  },
  player: function () {
    var p = $("#audio");
    if (!p.length) {
      $(".icon-play").css({
        color: "#dedede",
        cursor: "not-allowed",
      });
      return;
    }
    var sourceSrc = $("#audio source").eq(0).attr("src");
    if (sourceSrc == "" && p[0].src == "") {
      audiolist = $("#audio-list li");
      mp3 = audiolist.eq([Math.floor(Math.random() * audiolist.size())]);
      p[0].src = mp3.data("url");
    }

    if (p.eq(0).data("autoplay") == true) {
      p[0].play();
    }

    p.on({
      timeupdate: function () {
        var progress = (p[0].currentTime / p[0].duration) * 100;
        $(".bar").css("width", progress + "%");
        if (progress / 5 <= 1) {
          p[0].volume = progress / 5;
        } else {
          p[0].volume = 1;
        }
      },
      ended: function () {
        $(".icon-pause").removeClass("icon-pause").addClass("icon-play");
      },
      playing: function () {
        $(".icon-play").removeClass("icon-play").addClass("icon-pause");
      },
    });
  },
  loading: function () {
    // 空函数，保留以避免其他地方的调用出错
  },
  loaded: function () {
    // 空函数，保留以避免其他地方的调用出错
  },
  F: function (id, w, h) {
    var _height = $(id).parent().height(),
      _width = $(id).parent().width(),
      ratio = h / w;
    if (_height / _width > ratio) {
      id.style.height = _height + "px";
      id.style.width = _height / ratio + "px";
    } else {
      id.style.width = _width + "px";
      id.style.height = _width * ratio + "px";
    }
    id.style.left = (_width - parseInt(id.style.width)) / 2 + "px";
    id.style.top = (_height - parseInt(id.style.height)) / 2 + "px";
  },
};

$(function () {
  if (Diaspora.P()) {
    $("body").addClass("touch");
  }
  if ($("#preview").length) {
    var cover = {};
    cover.t = $("#cover");
    cover.w = cover.t.attr("width");
    cover.h = cover.t.attr("height");
    (cover.o = function () {
      $("#mark").height(window.innerHeight);
    })();
    if (cover.t.prop("complete")) {
      // why setTimeout ?
      setTimeout(function () {
        cover.t.load();
      }, 0);
    }
    cover.t.on("load", function () {
      (cover.f = function () {
        var _w = $("#mark").width(),
          _h = $("#mark").height(),
          x,
          y,
          i,
          e;
        e = _w >= 1000 || _h >= 1000 ? 1000 : 500;
        if (_w >= _h) {
          i = (_w / e) * 50;
          y = i;
          x = (i * _w) / _h;
        } else {
          i = (_h / e) * 50;
          x = i;
          y = (i * _h) / _w;
        }
        $(".layer").css({
          width: _w + x,
          height: _h + y,
          marginLeft: -0.5 * x,
          marginTop: -0.5 * y,
        });
        if (!cover.w) {
          cover.w = cover.t.width();
          cover.h = cover.t.height();
        }
        Diaspora.F($("#cover")[0], cover.w, cover.h);
      })();
      setTimeout(function () {
        $("html, body").removeClass("loading");
      }, 1000);
      var scene = document.getElementById('mark');
      new Parallax(scene, {
        relativeInput: true,
        hoverOnly: true,
        calibrateX: false,
        calibrateY: true,
        limitX: 30,          // 水平方向的移动范围
        limitY: 30,          // 垂直方向的移动范围
        scalarX: 5,          // 移动幅度
        scalarY: 5,          // 移动幅度
        frictionX: 0.1,      // 水平方向的阻力
        frictionY: 0.1       // 垂直方向的阻力
      });
      Vibrant.from(cover.t[0]).getPalette().then(function(palette) {
        if (palette.DarkVibrant) {
          $("#vibrant polygon").css("fill", palette.DarkVibrant.hex);
          $("#vibrant div").css("background-color", palette.DarkVibrant.hex);
        }
        if (palette.Vibrant) {
          $(".icon-menu").css("color", palette.Vibrant.hex);
          $(".icon-search").css("color", palette.Vibrant.hex);
        }
      });
    });
    if (!cover.t.attr("src")) {
      alert("Please set the post thumbnail");
    }
    $("#preview").css("min-height", window.innerHeight);
    Diaspora.PS();
    $(".pview a").addClass("pviewa");
    var T;
    $(window).on("resize", function () {
      clearTimeout(T);
      T = setTimeout(function () {
        if (!Diaspora.P() && location.href == Home) {
          cover.o();
          cover.f();
        }
        if ($("#loader").attr("class")) {
          Diaspora.loading();
        }
      }, 500);
    });
  } else {
    $("#single").css("min-height", window.innerHeight);
    setTimeout(function () {
      $("html, body").removeClass("loading");
    }, 1000);
    window.addEventListener("popstate", function (e) {
      if (e.state) location.href = e.state.u;
    });
    Diaspora.player();
    $(".icon-icon, .image-icon").attr("href", "/");
    $("#top").show();
  }
  $(window).on("scroll", function () {
    if ($(".scrollbar").length && !Diaspora.P() && !$(".icon-images").hasClass("active")) {
      var wt = $(window).scrollTop(),
        tw = $("#top").width(),
        dh = document.body.scrollHeight,
        wh = $(window).height();
      var width = (tw / (dh - wh)) * wt;
      $(".scrollbar").width(width);
      if (wt > 80 && window.innerWidth > 800) {
        $(".subtitle").fadeIn();
      } else {
        $(".subtitle").fadeOut();
      }
    }
  });
  $(window).on("touchmove", function (e) {
    if ($("body").hasClass("mu")) {
      e.preventDefault();
    }
  });

  //搜搜
  var searchFunc = function (path, search_id, content_id) {
    "use strict";
    $.ajax({
      url: path,
      dataType: "xml",
      success: function (xmlResponse) {
        var datas = $("entry", xmlResponse)
          .map(function () {
            return {
              title: $("title", this).text(),
              content: $("content", this).text(),
              url: $("url", this).text(),
            };
          })
          .get();
        var $input = document.getElementById(search_id);
        var $resultContent = document.getElementById(content_id);
        $input.addEventListener("input", function () {
          var str = '<ul class="search-result-list">';
          var keywords = this.value
            .trim()
            .toLowerCase()
            .split(/[\s\-]+/);
          $resultContent.innerHTML = "";
          if (this.value.trim().length <= 0) {
            return;
          }
          datas.forEach(function (data) {
            var isMatch = true;
            var content_index = [];
            var data_title = data.title.trim().toLowerCase();
            var data_content = data.content
              .trim()
              .replace(/<[^>]+>/g, "")
              .toLowerCase();
            var data_url = data.url;
            var index_title = -1;
            var index_content = -1;
            var first_occur = -1;
            // 只匹配非空文章
            if (data_title != "" && data_content != "") {
              keywords.forEach(function (keyword, i) {
                index_title = data_title.indexOf(keyword);
                index_content = data_content.indexOf(keyword);
                if (index_title < 0 && index_content < 0) {
                  isMatch = false;
                } else {
                  if (index_content < 0) {
                    index_content = 0;
                  }
                  if (i == 0) {
                    first_occur = index_content;
                  }
                }
              });
            }
            if (isMatch) {
              str += "<li><a href='" + data_url + "' class='search-result-title' target='_blank'>" + data_title + "</a>";
              var content = data.content.trim().replace(/<[^>]+>/g, "");
              if (first_occur >= 0) {
                var start = first_occur - 6;
                var end = first_occur + 6;
                if (start < 0) {
                  start = 0;
                }
                if (start == 0) {
                  end = 10;
                }
                if (end > content.length) {
                  end = content.length;
                }
                var match_content = content.substr(start, end);
                keywords.forEach(function (keyword) {
                  var regS = new RegExp(keyword, "gi");
                  match_content = match_content.replace(regS, '<em class="search-keyword">' + keyword + "</em>");
                });
                str += '<p class="search-result">' + match_content + "...</p>";
              }
            }
          });
          $resultContent.innerHTML = str;
        });
      },
    });
  };
  var path = window.searchDbPath || "/search.xml";
  if (document.getElementById("local-search-input") !== null) {
    searchFunc(path, "local-search-input", "local-search-result");
  }

  var typed = null;
  $("body").on("click", function (e) {
    var tag = $(e.target).attr("class") || "",
      rel = $(e.target).attr("rel") || "";
    // .content > ... > img
    if (e.target.nodeName == "IMG" && $(e.target).parents("div.content").length > 0) {
      tag = "pimg";
    }
    if (!tag && !rel) return;
    switch (true) {
      // nav menu
      case tag.indexOf("switchmenu") != -1:
        window.scrollTo(0, 0);

        $("html, body").toggleClass("mu");
        if (typed !== null) {
          typed.destroy();
          typed = null;
        } else {
          if ($("#hitokoto").data("st") == true) {
            $.get("https://v1.hitokoto.cn/", function (data) {
              var data = data;
              var str = data.hitokoto + " ——  By ";
              var options = {
                strings: [
                  //str + "Who??^1000",
                  //str + "It's me^2000",
                  //str +'Haha, make a joke',
                  str + data.from,
                ],
                typeSpeed: 90,
                startDelay: 500,
                //backDelay: 500,
                //backSpeed: 50,//回退速度
                //loop: true,
              };
              typed = new Typed(".hitokoto .typed", options);
            });
          }
        }
        return false;
      //search
      case tag.indexOf("switchsearch") != -1:
        $("body").removeClass("mu");
        if (typed !== null) {
          typed.destroy();
          typed = null;
        }
        setTimeout(function () {
          Diaspora.HS($(e.target), "push");
          $(".toc").fadeIn(1000);
          searchFunc(path, "local-search-input", "local-search-result");
        }, 300);
        return false;
      // next page
      case tag.indexOf("more") != -1:
        tag = $(".more");
        if (tag.data("status") == "loading") {
          return false;
        }
        var num = parseInt(tag.data("page")) || 1;
        if (num == 1) {
          tag.data("page", 1);
        }
        if (num >= Pages) {
          return;
        }
        tag.html("加载中...").data("status", "loading");
        Diaspora.loading();
        Diaspora.L(
          tag.attr("href"),
          function (data) {
            var link = $(data).find(".more").attr("href");
            if (link != undefined) {
              tag.attr("href", link).html("加载更多").data("status", "loaded");
              tag.data("page", parseInt(tag.data("page")) + 1);
            } else {
              $("#pager").remove();
            }
            var tempScrollTop = $(window).scrollTop();
            $("#primary").append($(data).find(".post"));
            $(window).scrollTop(tempScrollTop + 100);
            Diaspora.loaded();
            $("html,body").animate({ scrollTop: tempScrollTop + 400 }, 500);
          },
          function () {
            tag.html("加载更多").data("status", "loaded");
          }
        );
        return false;
      // home
      case tag.indexOf("icon-home") != -1:
        $(".toc").fadeOut(100);
        if ($("#preview").hasClass("show")) {
          history.back();
        } else {
          location.href = $(".icon-home").data("url");
        }
        return false;
      // qrcode
      case tag.indexOf("icon-scan") != -1:
        if ($(".icon-scan").hasClass("tg")) {
          $("#qr").toggle();
        } else {
          $(".icon-scan").addClass("tg");
          $("#qr").qrcode({ width: 128, height: 128, text: location.href }).toggle();
        }
        return false;
      // audio play
      case tag.indexOf("icon-play") != -1:
        $("#audio")[0].play();
        $(".icon-play").removeClass("icon-play").addClass("icon-pause");
        return false;
      // audio pause
      case tag.indexOf("icon-pause") != -1:
        $("#audio")[0].pause();
        $(".icon-pause").removeClass("icon-pause").addClass("icon-play");
        return false;
      // history state
      case tag.indexOf("cover") != -1:
        Diaspora.HS($(e.target).parent(), "push");
        return false;
      // history state
      case tag.indexOf("posttitle") != -1:
        Diaspora.HS($(e.target), "push");
        return false;
      // prev, next post
      case rel == "prev" || rel == "next":
        if (rel == "prev") {
          var t = $("#prev_next a")[0].text;
        } else {
          var t = $("#prev_next a")[1].text;
        }
        $(e.target).attr("title", t);
        Diaspora.HS($(e.target), "replace");
        return false;
      // toc
      case tag.indexOf("toc-text") != -1 || tag.indexOf("toc-link") != -1 || tag.indexOf("toc-number") != -1:
        hash = "";
        if (e.target.nodeName == "SPAN") {
          hash = $(e.target).parent().attr("href");
        } else {
          hash = $(e.target).attr("href");
        }
        to = $(decodeURI(hash));
        $("html,body").animate(
          {
            scrollTop: to.offset().top - 50,
          },
          300
        );
        return false;
      // quick view
      case tag.indexOf("pviewa") != -1:
        $("body").removeClass("mu");
        if (typed !== null) {
          typed.destroy();
          typed = null;
        }
        setTimeout(function () {
          Diaspora.HS($(e.target), "push");
          $(".toc").fadeIn(1000);
          initComments();
        }, 300);
        return false;
      // photoswipe
      case tag.indexOf("pimg") != -1:
        var pswpElement = $(".pswp").get(0);
        if (pswpElement) {
          var items = [];
          var index = 0;
          var imgs = [];
          $(".content img").each(function (i, v) {
            // get index
            if (e.target.src == v.src) {
              index = i;
            }
            var item = {
              src: v.src,
              w: v.naturalWidth,
              h: v.naturalHeight,
            };
            imgs.push(v);
            items.push(item);
          });
          var options = {
            index: index,
            shareEl: false,
            zoomEl: false,
            allowRotationOnUserZoom: true,
            history: false,
            getThumbBoundsFn: function (index) {
              // See Options -> getThumbBoundsFn section of documentation for more info
              var thumbnail = imgs[index],
                pageYScroll = window.pageYOffset || document.documentElement.scrollTop,
                rect = thumbnail.getBoundingClientRect();

              return { x: rect.left, y: rect.top + pageYScroll, w: rect.width };
            },
          };
          var lightBox = new PhotoSwipe(pswpElement, PhotoSwipeUI_Default, items, options);
          lightBox.init();
        }
        return false;
      // comment
      // comment
      case -1 != tag.indexOf("comment"):
        var commentContainer = $("#comments-container");
        if (commentContainer.length) {
          Diaspora.loading();
          if (commentContainer.find("#gitalk-container").length) {
            var gitalkContainer = $("#gitalk-container");
            var gitalk = new Gitalk({
              clientID: gitalkContainer.data("ci"),
              clientSecret: gitalkContainer.data("cs"),
              repo: gitalkContainer.data("r"),
              owner: gitalkContainer.data("o"),
              admin: JSON.parse(gitalkContainer.data("a")),
              id: decodeURI(window.location.pathname),
              distractionFreeMode: gitalkContainer.data("d"),
            });
            gitalk.render("gitalk-container");
          } else if (commentContainer.find("#tcomment").length) {
            var twikooContainer = $("#tcomment");
            twikoo.init({
              envId: twikooContainer.data("e"),
              el: "#tcomment",
              region: twikooContainer.data("r"),
              visitor: twikooContainer.data("v"),
            });
          }
          $(".comment").removeClass("link");
          Diaspora.loaded();
        } else {
          commentContainer.html("评论已关闭");
        }
        return false;
      default:
        return true;
    }
  });
  // 是否自动展开评论
  function initComments() {
    var gitalkContainer = $("#gitalk-container");
    if (gitalkContainer.length && gitalkContainer.data("ae") == true) {
      gitalkContainer.click();
    }

    var twikooContainer = $("#tcomment");
    if (twikooContainer.length && twikooContainer.data("ae") == true) {
      twikooContainer.click();
    }
  }

  // Initialize comments on page load
  initComments();

  console.log("%c Github %c", "background:#24272A; color:#ffffff", "", "https://github.com/Fechin/hexo-theme-diaspora");
});
